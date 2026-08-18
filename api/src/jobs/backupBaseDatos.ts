// Respaldo diario de la base a Google Drive.
//
// Existe por el 18-ago-2026: un `migrate reset` corrido por error contra
// producción vació la base entera, y Railway solo ofrece backups en el plan
// Pro. Desde entonces la regla es: ninguna noche sin copia.
//
// El volcado es JSON por tabla (vía Prisma) y no `pg_dump`: el servidor corre
// Postgres 18 y el contenedor Alpine aún no trae un cliente 18, y un binario
// desalineado falla justo el día que se necesita. El JSON comprimido, junto a
// las migraciones del repo (el esquema), permite reconstruir todo con
// `scripts/restaurarBackup.ts`.
//
// Va a la carpeta "Backups" en la raíz del Drive de la cuenta dueña —aparte
// de la de cuentas de cobro, cada una con su variable— y se conservan los
// últimos 60; el más viejo se borra al subir uno nuevo.

import { gzipSync } from 'zlib'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { subirArchivoADrive, listarArchivosDrive, borrarArchivoDrive } from '../services/googleDrive'

const CONSERVAR = 60

function configurado(): boolean {
  return Boolean(process.env.DRIVE_BACKUPS_FOLDER_ID)
}

/** "2026-08-18 2359" en Colombia, para que el nombre diga la noche que cubre. */
function selloColombia(): string {
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
  return f.replace(' ', '-').replace(':', '')
}

export async function respaldarBaseDatos(): Promise<void> {
  if (!configurado()) {
    logger.warn('[Backup] Sin DRIVE_BACKUPS_FOLDER_ID — no hay respaldo nocturno')
    return
  }
  const inicio = Date.now()
  try {
    // Todas las tablas del esquema, también las vacías: un backup que omite
    // tablas obliga a adivinar en la restauración.
    const tablas = (await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    )).map(t => t.table_name)

    const datos: Record<string, unknown[]> = {}
    for (const t of tablas) {
      datos[t] = await prisma.$queryRawUnsafe(`select * from "${t}"`)
    }

    const cuerpo = JSON.stringify({
      generado: new Date().toISOString(),
      formato: 'grupo500-json-v1',
      tablas: datos,
    }, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
    const comprimido = gzipSync(Buffer.from(cuerpo, 'utf8'))

    const nombre = `backup-${selloColombia()}.json.gz`
    await subirArchivoADrive(nombre, comprimido, 'application/gzip', process.env.DRIVE_BACKUPS_FOLDER_ID!)

    const filas = Object.values(datos).reduce((s, f) => s + f.length, 0)
    logger.info(`[Backup] ${nombre} — ${tablas.length} tablas, ${filas} filas, ` +
      `${(comprimido.length / 1024 / 1024).toFixed(1)}MB en ${Math.round((Date.now() - inicio) / 1000)}s`)

    // Poda: los backups viejos se van solos, para no llenar el Drive.
    const archivos = await listarArchivosDrive(process.env.DRIVE_BACKUPS_FOLDER_ID!)
    for (const viejo of archivos.slice(CONSERVAR)) {
      await borrarArchivoDrive(viejo.id)
      logger.info(`[Backup] Podado ${viejo.name}`)
    }
  } catch (e: any) {
    // Nunca tumba el servidor: un backup fallido se reintenta a la noche
    // siguiente y el arranque del día siguiente lo detecta (ver index.ts).
    logger.error(`[Backup] Falló el respaldo: ${e?.message}`)
  }
}

/** ¿El backup más reciente tiene más de `horas`? (true también si no hay ninguno) */
export async function backupVencido(horas: number): Promise<boolean> {
  if (!configurado()) return false
  try {
    const archivos = await listarArchivosDrive(process.env.DRIVE_BACKUPS_FOLDER_ID!)
    if (archivos.length === 0) return true
    return Date.now() - new Date(archivos[0].createdTime).getTime() > horas * 3600_000
  } catch {
    return false
  }
}

/** Hora:minuto actual en Colombia, "23:59". */
export function horaColombia(): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
}
