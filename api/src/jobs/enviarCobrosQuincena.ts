/**
 * El envío quincenal de cuentas de cobro a Drive.
 *
 * En Grupo 500 los pagos de freelance son quincenales, así que un día antes de
 * cada quincena —el 14 y el penúltimo día del mes, a las 8:00 de Colombia— el
 * servidor archiva en Drive la cuenta de cobro de todo trabajo APROBADO que
 * siga sin archivar, dibujándola él mismo (services/cuentaCobroPdf) con los
 * mismos trazos que la del navegador. Y un día antes de ESO —el 13 y el
 * antepenúltimo— les avisa a quienes aprueban cuánto sigue sin visto bueno,
 * para que el corte no los agarre (decisión de Hotman, 20-ago).
 *
 * Arranca en MODO SIMULACIÓN: registra en el log qué habría enviado, sin tocar
 * Drive ni marcar nada. Se vuelve real con COBROS_QUINCENA_REAL=true en el
 * entorno, cuando Hotman haya visto un par de simulaciones en los logs.
 *
 * El candado del día vive en ConfigApp y no en memoria: si Railway reinicia el
 * contenedor a las 8:03, el reintento del minuto siguiente lo encuentra y no
 * duplica el envío.
 */

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { generarCuentaDeCobro, type DatosPersona } from '../services/cuentaCobroPdf'
import { subirCuentaDeCobro, driveConfigurado } from '../services/googleDrive'
import { avisar } from '../services/notificaciones'
import { LIDERES_MARKETING } from '../utils/roles'

const CLAVE_ENVIO = 'cobros_quincena_ultimo_envio'
const CLAVE_AVISO = 'cobros_quincena_ultimo_aviso'

const simulacro = () => process.env.COBROS_QUINCENA_REAL !== 'true'

/** Hoy en Colombia, desarmado. El servidor corre en UTC. */
function hoyColombia() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const v = (t: string) => Number(partes.find(p => p.type === t)?.value ?? 0)
  const anio = v('year'), mes = v('month'), dia = v('day')
  return {
    anio, mes, dia,
    hora: v('hour'),
    fecha: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    ultimoDia: new Date(anio, mes, 0).getDate(),
  }
}

/** El candado en ConfigApp: true si este día ya se corrió esa tarea. */
async function yaCorrio(clave: string, fecha: string): Promise<boolean> {
  const marca = await prisma.configApp.findUnique({ where: { clave } })
  if (marca?.valor === fecha) return true
  await prisma.configApp.upsert({
    where:  { clave },
    update: { valor: fecha },
    create: { clave, valor: fecha },
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

/** Archiva en Drive todo cobro aprobado que siga sin cuenta de cobro. */
async function enviarPendientes() {
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
    logger.info('[CobrosQuincena] Nada pendiente de archivar: todo cobro aprobado ya tiene su cuenta en Drive')
    return
  }

  let subidos = 0
  const omitidos: string[] = []

  for (const cobro of pendientes) {
    const p = cobro.asignadoA
    if (!p) { omitidos.push(`"${cobro.titulo}" — sin responsable`); continue }
    const faltan = datosFaltantes(p)
    if (faltan.length > 0) { omitidos.push(`"${cobro.titulo}" (${p.nombre}) — falta ${faltan.join(', ')}`); continue }

    const datos = {
      concepto: cobro.titulo,
      valor: cobro.valor ?? 0,
      fecha: cobro.aprobadoEn ?? new Date(),
    }

    if (simulacro()) {
      logger.info(`[CobrosQuincena] SIMULACRO: enviaría "${cobro.titulo}" de ${p.nombre} por ${enPesos(datos.valor)}`)
      subidos++
      continue
    }

    try {
      const { pdf, archivo } = await generarCuentaDeCobro(p, datos)
      // La carpeta de quincena se elige por HOY, no por la fecha del trabajo:
      // el archivo acompaña al pago que lo origina.
      const subido = await subirCuentaDeCobro(archivo, pdf, new Date())
      await prisma.contenidoMarketing.update({
        where: { id: cobro.id },
        data: { cuentaCobroUrl: subido.url, cuentaCobroEn: new Date() },
      })
      subidos++
      logger.info(`[CobrosQuincena] Archivada "${cobro.titulo}" de ${p.nombre} en ${subido.carpeta}`)
    } catch (e: any) {
      // Un cobro que falla no frena a los demás; queda para el próximo corte.
      logger.error(`[CobrosQuincena] No pude archivar "${cobro.titulo}" de ${p.nombre}: ${e?.message}`)
      omitidos.push(`"${cobro.titulo}" (${p.nombre}) — ${e?.message ?? 'error al subir'}`)
    }
  }

  const modo = simulacro() ? 'SIMULACRO — nada se subió de verdad' : 'enviadas a Drive'
  logger.info(`[CobrosQuincena] Corte del día: ${subidos} cuenta(s) ${modo}; ${omitidos.length} omitida(s)`)
  for (const o of omitidos) logger.warn(`[CobrosQuincena] Omitida: ${o}`)

  // El resumen les llega a quienes aprueban, para que sepan qué quedó por
  // fuera y por qué — un PDF que no salió es plata que alguien no recibe.
  if (!simulacro() && (subidos > 0 || omitidos.length > 0)) {
    const texto = omitidos.length > 0
      ? `Corte de quincena: ${subidos} cuenta(s) de cobro archivadas en Drive y ${omitidos.length} sin poder emitir (datos incompletos o error). Revisa Cobros.`
      : `Corte de quincena: ${subidos} cuenta(s) de cobro archivadas en Drive.`
    await avisarALideres(texto, 'Cuentas de cobro enviadas')
  }
}

/** Un día antes del corte: cuánto sigue sin aprobar. */
async function avisarCorte() {
  const sinAprobar = await prisma.contenidoMarketing.findMany({
    where: { tipoTrabajo: 'FREELANCE', estadoCobro: 'POR_APROBAR', valor: { gt: 0 } },
    select: { valor: true },
  })
  if (sinAprobar.length === 0) {
    logger.info('[CobrosQuincena] Víspera de corte: no hay trabajos sin aprobar')
    return
  }
  const total = sinAprobar.reduce((s, c) => s + (c.valor ?? 0), 0)
  const texto = `Mañana se envían las cuentas de cobro a Drive y ${sinAprobar.length} trabajo(s) freelance por ${enPesos(total)} siguen sin aprobar. Lo que no esté aprobado no se envía.`
  logger.info(`[CobrosQuincena] ${texto}${simulacro() ? ' (SIMULACRO: el aviso sí se manda, el envío de mañana no)' : ''}`)
  await avisarALideres(texto, 'Mañana es el corte de cobros')
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
 * El chequeo que corre cada minuto desde index.ts.
 *
 * A las 8 de Colombia: el 13 y el antepenúltimo día avisa; el 14 y el
 * penúltimo envía. Se compara `>= 8` y no `=== 8:00` para que un contenedor
 * caído a las 8 en punto lo recupere al volver, el mismo día.
 */
export async function revisarCobrosQuincena() {
  try {
    const hoy = hoyColombia()
    if (hoy.hora < 8) return

    const esDiaEnvio = hoy.dia === 14 || hoy.dia === hoy.ultimoDia - 1
    const esDiaAviso = hoy.dia === 13 || hoy.dia === hoy.ultimoDia - 2

    if (esDiaAviso && !(await yaCorrio(CLAVE_AVISO, hoy.fecha))) await avisarCorte()
    if (esDiaEnvio && !(await yaCorrio(CLAVE_ENVIO, hoy.fecha))) {
      if (!driveConfigurado() && !simulacro()) {
        logger.error('[CobrosQuincena] Drive no está configurado: el envío real no puede correr')
        return
      }
      await enviarPendientes()
    }
  } catch (e: any) {
    logger.error(`[CobrosQuincena] ${e?.message ?? e}`)
  }
}
