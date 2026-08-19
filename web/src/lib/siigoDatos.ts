import { prisma } from '@/lib/prisma'
import { claveNombre } from '@/lib/contabilidadMarketing'
import { FilaSiigo, LARGO_DESCRIPCION, LARGO_OBSERVACIONES, fechaSiigo, recortar } from '@/lib/siigo'

// Arma el comprobante de una quincena con los datos que haya. Los códigos del
// plan de cuentas viven en ConfigApp (claves SIIGO_*), igual que las
// credenciales de Meta; mientras no estén, sus columnas salen vacías en vez de
// inventadas: el contador las completa en Excel y las arrastra, que es la
// única parte que se repite igual en todas las filas.

export const CLAVES_SIIGO = {
  tipo: 'SIIGO_TIPO_COMPROBANTE',
  consecutivo: 'SIIGO_CONSECUTIVO',
  gasto: 'SIIGO_CUENTA_GASTO',
  contrapartida: 'SIIGO_CUENTA_CONTRAPARTIDA',
} as const

const NOMBRE_LEGIBLE: Record<string, string> = {
  SIIGO_TIPO_COMPROBANTE: 'Tipo de comprobante (código numérico de 3 dígitos)',
  SIIGO_CONSECUTIVO: 'Consecutivo del comprobante',
  SIIGO_CUENTA_GASTO: 'Cuenta contable del gasto (nivel transaccional)',
  SIIGO_CUENTA_CONTRAPARTIDA: 'Cuenta contable de la contrapartida (crédito)',
}

export interface Comprobante {
  filas: FilaSiigo[]
  registros: number
  /** Lo que el archivo deja en blanco porque todavía no existe en la app. */
  configuracionPendiente: string[]
  personasSinCedula: string[]
  completo: boolean
}

/** Último día de la quincena: Q1 cierra el 15, Q2 el último del mes. */
function fechaCierre(quincena: string): Date {
  const anio = Number(quincena.slice(0, 4))
  const mes = Number(quincena.slice(5, 7))
  return quincena.slice(8) === 'Q1' ? new Date(anio, mes - 1, 15) : new Date(anio, mes, 0)
}

export async function armarComprobante(quincena: string): Promise<Comprobante> {
  const [config, registros] = await Promise.all([
    prisma.configApp.findMany({ where: { clave: { startsWith: 'SIIGO_' } } }),
    prisma.contabRegistro.findMany({
      where: { quincena, rechazado: false },
      include: { persona: { include: { dept: true } } },
      orderBy: [{ persona: { deptId: 'asc' } }, { persona: { nombre: 'asc' } }, { id: 'asc' }],
    }),
  ])

  const valor = new Map(config.map(c => [c.clave, c.valor.trim()]))
  const configuracionPendiente = Object.values(CLAVES_SIIGO)
    .filter(k => !valor.get(k))
    .map(k => NOMBRE_LEGIBLE[k])

  // Se avisa una vez por persona, no una por fila: quien trabaja en tres áreas
  // tiene tres filas de contab_personas y aparecería tres veces, a veces hasta
  // escrita distinto. Se agrupa con la misma clave que usa el buscador.
  const sinCedula = new Map<string, string>()
  for (const r of registros) {
    if (r.persona.cedula?.trim()) continue
    const clave = claveNombre(r.persona.nombre)
    if (!sinCedula.has(clave)) sinCedula.set(clave, r.persona.nombre)
  }
  const personasSinCedula = [...sinCedula.values()].sort((a, b) => a.localeCompare(b, 'es'))

  const comunes = {
    tipoComprobante: valor.get(CLAVES_SIIGO.tipo) ?? '',
    consecutivoComprobante: valor.get(CLAVES_SIIGO.consecutivo) ?? '',
    fechaElaboracion: fechaSiigo(fechaCierre(quincena)),
  }

  // Partida doble: cada actividad entra como gasto al débito y como cuenta por
  // pagar de la persona al crédito, así el comprobante cuadra siempre —incluso
  // sin los códigos, porque las columnas de valor no dependen de ellos.
  const filas: FilaSiigo[] = []
  for (const r of registros) {
    const base = {
      ...comunes,
      identificacionTercero: r.persona.cedula?.trim() ?? '',
      centroCostos: valor.get(`SIIGO_CENTRO_${r.persona.deptId.toUpperCase()}`) ?? '',
      descripcion: recortar(r.actividad, LARGO_DESCRIPCION),
      observaciones: recortar(
        `${r.categoria} · ${r.persona.dept.nombre} · ${r.persona.nombre} · ${r.fecha}`,
        LARGO_OBSERVACIONES,
      ),
    }
    filas.push({ ...base, codigoCuenta: valor.get(CLAVES_SIIGO.gasto) ?? '', debito: r.valor })
    filas.push({ ...base, codigoCuenta: valor.get(CLAVES_SIIGO.contrapartida) ?? '', credito: r.valor })
  }

  return {
    filas,
    registros: registros.length,
    configuracionPendiente,
    personasSinCedula,
    completo: configuracionPendiente.length === 0 && personasSinCedula.length === 0,
  }
}
