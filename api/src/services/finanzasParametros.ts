import { prisma } from '../config/prisma'

/**
 * Umbrales de la segmentación RFV.
 *
 * Viven en base de datos porque son criterio de negocio, no técnica: quien
 * define desde cuándo un cliente está "inactivo" es dirección, y debe poder
 * moverlo sin un despliegue. Los valores por defecto vienen del cuadro de
 * indicadores que ya se usaba en Excel.
 */
export interface Umbrales {
  rReciente: number
  rIntermedio: number
  rInactivo: number
  fRecurrente: number
  vAlto: number
  vMedio: number
  nuevoDias: number
}

export const UMBRALES_POR_DEFECTO: Umbrales = {
  rReciente: 15,
  rIntermedio: 30,
  rInactivo: 45,
  fRecurrente: 2,
  vAlto: 700_000,
  vMedio: 380_000,
  nuevoDias: 30,
}

const PREFIJO = 'rfv.'

export async function leerUmbrales(): Promise<Umbrales> {
  const filas = await prisma.parametroFinanzas.findMany({
    where: { clave: { startsWith: PREFIJO } },
  })
  const guardados = Object.fromEntries(
    filas.map(f => [f.clave.slice(PREFIJO.length), Number(f.valor)]),
  )
  // Un parámetro ausente o corrupto cae al valor por defecto: es preferible a
  // segmentar con NaN y dejar a todo el mundo en el mismo grupo.
  const tomar = (k: keyof Umbrales) =>
    Number.isFinite(guardados[k]) ? guardados[k] : UMBRALES_POR_DEFECTO[k]

  return {
    rReciente: tomar('rReciente'),
    rIntermedio: tomar('rIntermedio'),
    rInactivo: tomar('rInactivo'),
    fRecurrente: tomar('fRecurrente'),
    vAlto: tomar('vAlto'),
    vMedio: tomar('vMedio'),
    nuevoDias: tomar('nuevoDias'),
  }
}

export async function guardarUmbrales(valores: Partial<Umbrales>): Promise<Umbrales> {
  const entradas = Object.entries(valores).filter(([, v]) => Number.isFinite(v))
  await prisma.$transaction(
    entradas.map(([k, v]) =>
      prisma.parametroFinanzas.upsert({
        where: { clave: PREFIJO + k },
        create: { clave: PREFIJO + k, valor: String(v), descripcion: 'Umbral de segmentación RFV' },
        update: { valor: String(v) },
      }),
    ),
  )
  return leerUmbrales()
}
