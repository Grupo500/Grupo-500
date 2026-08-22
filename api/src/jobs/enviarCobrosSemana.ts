/**
 * El envío semanal de cuentas de cobro a Drive.
 *
 * Domingo a viernes se trabaja; el sábado Cristal revisa y aprueba; y el
 * sábado a las 23:59 (Colombia) el servidor arma UNA cuenta de cobro por
 * freelance con todos sus trabajos aprobados que sigan sin enviar —cada
 * trabajo con su valor y el total al pie, dibujada en services/cuentaCobroPdf—
 * y la sube a la carpeta de Drive que ya está conectada (decisión de Hotman,
 * 22-ago; antes iba una cuenta por trabajo, cada quincena, y la dibujaba el
 * navegador).
 *
 * Lo publicado un sábado entra en la semana siguiente: no porque esto lo
 * filtre —se envía TODO lo aprobado y sin enviar— sino porque Cristal revisa
 * lo de domingo a viernes, así su lista está congelada cuando se sienta a
 * aprobar. Si un sábado quiere meter algo urgente, lo aprueba y sale esa noche.
 *
 * Arranca en MODO SIMULACIÓN: escribe en el log qué habría enviado, sin tocar
 * Drive ni marcar nada. Se vuelve real con COBROS_SEMANA_REAL=true en el
 * entorno, cuando Hotman haya visto una simulación en los logs.
 *
 * El candado vive en ConfigApp con la fecha del corte (la del sábado): si el
 * contenedor estaba caído a las 23:59, el chequeo del minuto siguiente —o del
 * domingo por la mañana— encuentra el corte vencido y lo cumple; y si ya se
 * cumplió, no lo repite.
 */

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { generarCuentaDeCobro, type DatosPersona, type ItemCobro } from '../services/cuentaCobroPdf'
import { subirCuentaDeCobro, driveConfigurado } from '../services/googleDrive'
import { avisar } from '../services/notificaciones'
import { LIDERES_MARKETING } from '../utils/roles'

const CLAVE_ENVIO = 'cobros_semana_ultimo_envio'

const simulacro = () => process.env.COBROS_SEMANA_REAL !== 'true'

/** Ahora en Colombia, desarmado. El servidor corre en UTC. */
function ahoraColombia() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(new Date())
  const v = (t: string) => partes.find(p => p.type === t)?.value ?? ''
  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    anio: Number(v('year')), mes: Number(v('month')), dia: Number(v('day')),
    hora: Number(v('hour')) % 24, minuto: Number(v('minute')),
    diaSemana: DIAS.indexOf(v('weekday')),
  }
}

/** La fecha (AAAA-MM-DD) del último sábado 23:59 que ya pasó: el corte vigente. */
function corteVigente(): string {
  const a = ahoraColombia()
  // El sábado, antes de las 23:59, el corte vigente sigue siendo el del
  // sábado anterior; de domingo a viernes, el del sábado que acaba de pasar.
  const diasAtras = a.diaSemana === 6
    ? (a.hora === 23 && a.minuto >= 59 ? 0 : 7)
    : a.diaSemana + 1
  const d = new Date(Date.UTC(a.anio, a.mes - 1, a.dia))
  d.setUTCDate(d.getUTCDate() - diasAtras)
  return d.toISOString().slice(0, 10)
}

/** El candado en ConfigApp: true si ese corte ya se cumplió. */
async function yaCorrio(clave: string, corte: string): Promise<boolean> {
  const marca = await prisma.configApp.findUnique({ where: { clave } })
  if (marca?.valor === corte) return true
  await prisma.configApp.upsert({
    where:  { clave },
    update: { valor: corte },
    create: { clave, valor: corte },
  })
  return false
}

const enPesos = (n: number) => '$' + n.toLocaleString('es-CO')

/** Los datos sin los cuales la cuenta de cobro no se puede emitir. */
function datosFaltantes(p: DatosPersona): string[] {
  return [
    !p.nombreCompleto && 'nombre completo',
    !p.cedula && 'cédula',
    !p.banco && 'banco',
    !p.numeroCuenta && 'número de cuenta',
  ].filter(Boolean) as string[]
}

/** Una cuenta de cobro por persona con todo lo aprobado que siga sin enviar. */
async function enviarPendientes(corte: string) {
  const pendientes = await prisma.contenidoMarketing.findMany({
    where: {
      tipoTrabajo: 'FREELANCE',
      estadoCobro: { in: ['APROBADO', 'PAGADO'] },
      cuentaCobroUrl: null,
      valor: { gt: 0 },
    },
    include: { asignadoA: true },
    orderBy: { fecha: 'asc' },
  })
  if (pendientes.length === 0) {
    logger.info(`[CobrosSemana] Corte ${corte}: nada pendiente de enviar`)
    return
  }

  // Agrupado por persona: a un freelance se le manda UNA cuenta con todo.
  type Grupo = { persona: NonNullable<(typeof pendientes)[number]['asignadoA']>; cobros: typeof pendientes }
  const grupos = new Map<string, Grupo>()
  const omitidos: string[] = []
  for (const cobro of pendientes) {
    if (!cobro.asignadoA) { omitidos.push(`"${cobro.titulo}" — sin responsable`); continue }
    const g = grupos.get(cobro.asignadoA.id) ?? { persona: cobro.asignadoA, cobros: [] }
    g.cobros.push(cobro)
    grupos.set(cobro.asignadoA.id, g)
  }

  // El sábado de corte al mediodía de Colombia: así el mes de la carpeta, el
  // nombre de la semana y la fecha impresa salen del sábado aunque el
  // servidor, en UTC, ya esté en la madrugada del domingo.
  const fechaCorte = new Date(`${corte}T12:00:00-05:00`)

  let enviadas = 0
  let trabajos = 0
  for (const { persona, cobros } of grupos.values()) {
    const faltan = datosFaltantes(persona)
    if (faltan.length > 0) {
      omitidos.push(`${persona.nombre} (${cobros.length} trabajo${cobros.length !== 1 ? 's' : ''}) — falta ${faltan.join(', ')}`)
      continue
    }

    const items: ItemCobro[] = cobros.map(c => ({ concepto: c.titulo, valor: c.valor ?? 0 }))
    const total = items.reduce((s, i) => s + i.valor, 0)

    if (simulacro()) {
      logger.info(`[CobrosSemana] SIMULACRO: enviaría a ${persona.nombre} una cuenta con ${items.length} trabajo(s) por ${enPesos(total)}`)
      enviadas++
      trabajos += items.length
      continue
    }

    try {
      const { pdf, archivo } = await generarCuentaDeCobro(persona, { items, fecha: fechaCorte })
      // La carpeta de Drive se elige por el sábado de corte, no por la fecha
      // de los trabajos: el archivo acompaña al pago que lo origina.
      const subido = await subirCuentaDeCobro(archivo, pdf, fechaCorte)
      await prisma.contenidoMarketing.updateMany({
        where: { id: { in: cobros.map(c => c.id) } },
        data: { cuentaCobroUrl: subido.url, cuentaCobroEn: new Date() },
      })
      enviadas++
      trabajos += items.length
      logger.info(`[CobrosSemana] Enviada la cuenta de ${persona.nombre}: ${items.length} trabajo(s), ${enPesos(total)}, en ${subido.carpeta}`)
    } catch (e: any) {
      // Una persona que falla no frena a las demás; lo suyo sale el sábado
      // siguiente, porque sus trabajos siguen sin cuenta.
      logger.error(`[CobrosSemana] No pude enviar la cuenta de ${persona.nombre}: ${e?.message}`)
      omitidos.push(`${persona.nombre} — ${e?.message ?? 'error al subir'}`)
    }
  }

  const modo = simulacro() ? 'SIMULACRO — nada se subió de verdad' : 'enviadas a Drive'
  logger.info(`[CobrosSemana] Corte ${corte}: ${enviadas} cuenta(s) con ${trabajos} trabajo(s) ${modo}; ${omitidos.length} omitida(s)`)
  for (const o of omitidos) logger.warn(`[CobrosSemana] Omitida: ${o}`)

  // El resumen les llega a quienes aprueban: una cuenta que no salió es plata
  // que alguien no recibe, y hay que saber por qué.
  if (!simulacro() && (enviadas > 0 || omitidos.length > 0)) {
    const texto = omitidos.length > 0
      ? `Corte del sábado: ${enviadas} cuenta(s) de cobro enviadas a Drive y ${omitidos.length} persona(s) sin poder emitir (datos incompletos o error). Revisa Cobros.`
      : `Corte del sábado: ${enviadas} cuenta(s) de cobro enviadas a Drive con ${trabajos} trabajo(s).`
    await avisarALideres(texto, 'Cuentas de cobro enviadas')
  }
}

/** A todos los que aprueban cobros (Cristal entre ellos). */
async function avisarALideres(texto: string, titulo: string) {
  const lideres = await prisma.user.findMany({
    where: { role: { in: LIDERES_MARKETING as any } },
    select: { id: true },
  })
  for (const l of lideres) {
    await avisar({
      userId: l.id,
      tipo: 'CAMBIOS_PEDIDOS',
      texto,
      titulo,
      url: '/marketing/cobros',
    })
  }
}

/**
 * El chequeo que corre cada minuto desde index.ts: si el corte vigente (el
 * último sábado 23:59 que ya pasó) aún no se cumplió, lo cumple.
 */
export async function revisarCobrosSemana() {
  try {
    const corte = corteVigente()
    if (await yaCorrio(CLAVE_ENVIO, corte)) return
    if (!driveConfigurado() && !simulacro()) {
      logger.error('[CobrosSemana] Drive no está configurado: el envío real no puede correr')
      return
    }
    await enviarPendientes(corte)
  } catch (e: any) {
    logger.error(`[CobrosSemana] ${e?.message ?? e}`)
  }
}
