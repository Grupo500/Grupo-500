// Restaura un backup nocturno (backup-*.json.gz) sobre la base apuntada por
// DATABASE_URL.
//
// Uso:
//   npx tsx scripts/restaurarBackup.ts ./backup-2026-08-18-2359.json.gz            (simulación)
//   npx tsx scripts/restaurarBackup.ts ./backup-2026-08-18-2359.json.gz --commit   (restaura)
//
// Con --commit VACÍA cada tabla presente en el archivo y la rellena con lo
// del backup. Deshabilita las FK durante la carga (session_replication_role)
// para no depender del orden de inserción; el usuario de Railway es
// superusuario, así que está permitido.

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { prisma } from '../src/config/prisma'

async function main() {
  const ruta = process.argv[2]
  const commit = process.argv.includes('--commit')
  if (!ruta) { console.error('Falta la ruta del .json.gz'); process.exit(1) }

  const crudo = readFileSync(ruta)
  const json = JSON.parse(gunzipSync(crudo).toString('utf8'))
  if (json.formato !== 'grupo500-json-v1') { console.error('Formato desconocido:', json.formato); process.exit(1) }

  const tablas = Object.entries(json.tablas as Record<string, any[]>)
  console.log(`Backup generado: ${json.generado}`)
  console.log(`Tablas: ${tablas.length} · Filas: ${tablas.reduce((s, [, f]) => s + f.length, 0)}`)
  if (!commit) {
    for (const [t, f] of tablas) if (f.length) console.log(' ', t.padEnd(28), f.length)
    console.log('\nSimulación. Ejecuta con --commit para restaurar (VACÍA y rellena cada tabla).')
    return
  }

  // Columnas de fecha por tabla, para revivirlas desde el JSON.
  const tiposFecha = new Map<string, Set<string>>()
  for (const r of await prisma.$queryRawUnsafe<any[]>(
    `select table_name, column_name from information_schema.columns
     where table_schema='public' and data_type in ('timestamp without time zone','timestamp with time zone','date')`)) {
    if (!tiposFecha.has(r.table_name)) tiposFecha.set(r.table_name, new Set())
    tiposFecha.get(r.table_name)!.add(r.column_name)
  }

  await prisma.$executeRawUnsafe(`set session_replication_role = replica`)
  try {
    for (const [tabla, filas] of tablas) {
      await prisma.$executeRawUnsafe(`truncate table "${tabla}" cascade`)
      if (!filas.length) { console.log(tabla.padEnd(28), '0'); continue }
      const cols = Object.keys(filas[0])
      const fechas = tiposFecha.get(tabla) ?? new Set()
      // Inserción por lotes con parámetros: sin concatenar valores en el SQL.
      const LOTE = 200
      for (let i = 0; i < filas.length; i += LOTE) {
        const grupo = filas.slice(i, i + LOTE)
        const marcas: string[] = []
        const valores: unknown[] = []
        grupo.forEach((fila, fi) => {
          marcas.push('(' + cols.map((_, ci) => '$' + (fi * cols.length + ci + 1)).join(',') + ')')
          for (const c of cols) {
            let v = fila[c]
            if (v !== null && fechas.has(c)) v = new Date(v)
            else if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) v = JSON.stringify(v)
            valores.push(v)
          }
        })
        await prisma.$executeRawUnsafe(
          `insert into "${tabla}" (${cols.map(c => '"' + c + '"').join(',')}) values ${marcas.join(',')}`,
          ...valores)
      }
      console.log(tabla.padEnd(28), filas.length)
    }
  } finally {
    await prisma.$executeRawUnsafe(`set session_replication_role = default`)
  }
  console.log('\nRestauración completa.')
}

main().finally(() => prisma.$disconnect())
