// Prueba de punta a punta de la ESCRITURA en el sheet de gastos de agencia.
//
// Escribe de verdad, pero solo sobre una celda vacía de un mes futuro y la deja
// como estaba. Imprime antes y después para que quede rastro de lo que tocó.
//
// Uso:
//   GASTOS_AGENCIA_SHEET_ID=... GOOGLE_SHEETS_SA_JSON=ruta/al/key.json \
//     npx tsx scripts/probar-escritura-gastos.ts
//
// También sirve con GOOGLE_SHEETS_SA_EMAIL y GOOGLE_SHEETS_SA_PRIVATE_KEY ya
// definidos, que es como corre en producción.

import fs from 'node:fs'

// Si viene el JSON de la cuenta de servicio, se traduce a las dos variables que
// espera el servicio. Se hace antes de importar cualquier cosa que las lea.
const ruta = process.env.GOOGLE_SHEETS_SA_JSON
if (ruta) {
  const j = JSON.parse(fs.readFileSync(ruta, 'utf-8'))
  process.env.GOOGLE_SHEETS_SA_EMAIL = j.client_email
  process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY = j.private_key
}

async function main() {
  const { sheetsEscrituraConfigurada, pestanias } = await import('../src/services/googleSheets')
  const { obtenerGastosAgencia, traerPestania, at, money, GIDS, sheetId } =
    await import('../src/services/gastosAgencia')
  const { ubicarContabilidad, actualizarContabilidad, ConflictoSheet } =
    await import('../src/services/gastosAgenciaEscritura')

  const letra = (i: number) => {
    let n = i + 1, s = ''
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26) }
    return s
  }
  const cop = (n: number | null) => n == null ? '(vacío)' : n.toLocaleString('es-CO')

  console.log('1) Credenciales presentes:', sheetsEscrituraConfigurada())
  if (!sheetsEscrituraConfigurada()) {
    console.error('   Falta la cuenta de servicio. Aborto.')
    process.exit(1)
  }
  console.log('   cuenta:', process.env.GOOGLE_SHEETS_SA_EMAIL)

  console.log('\n2) Autenticación y permiso de lectura por la API...')
  const hojas = await pestanias(sheetId())
  console.log('   OK ·', hojas.length, 'pestañas:', hojas.map(h => `${h.title} (gid=${h.sheetId})`).join(' · '))

  console.log('\n3) Lectura y parseo por la API (no por el CSV público)...')
  const snap = await obtenerGastosAgencia(true)
  for (const [anio, a] of Object.entries(snap.anios).sort()) {
    console.log(`   ${anio}: total ${cop(a.totalAnio)} · ${a.categorias.length} categorías`)
  }
  console.log('   nómina:', snap.nomina.resumen.total, 'personas · avisos:', snap.avisos.length ? snap.avisos : '(ninguno)')

  // Se elige una celda vacía de un mes sin datos para no tocar contabilidad real.
  const anioActual = Object.keys(snap.anios).sort().reverse()[0]
  const hoja = snap.anios[anioActual]
  const mesLibre = hoja.totalPorMes.findIndex((v, i) => !v && i > 0)
  if (mesLibre < 0) {
    console.log('\n   No hay ningún mes vacío donde probar sin tocar datos reales. Aborto la escritura.')
    return
  }
  const categoria = hoja.categorias[hoja.categorias.length - 1]

  const rows = await traerPestania(hoja.gid)
  const pos = ubicarContabilidad(rows, categoria.clave, mesLibre)
  const original = money(at(rows, pos.fila, pos.columna))
  console.log(`\n   celda de prueba: ${letra(pos.columna)}${pos.fila + 1} (${categoria.nombre} · mes ${mesLibre + 1} de ${anioActual})`)
  console.log('   valor original:', cop(original))

  if (original != null) {
    console.log('   ¡Esa celda tiene datos! No escribo encima. Aborto.')
    return
  }

  console.log('\n4) Protección contra pisar el trabajo de otro (debe dar conflicto)...')
  try {
    await actualizarContabilidad({
      anio: anioActual, categoriaClave: categoria.clave, mes: mesLibre,
      valor: 1, valorAnterior: 999_999, // mentira a propósito
      usuario: 'prueba',
    })
    console.log('   ### FALLO: aceptó la escritura con un valor anterior equivocado')
    process.exitCode = 1
  } catch (e) {
    if (e instanceof ConflictoSheet) {
      console.log('   OK · rechazado con conflicto. El sheet dice:', cop(e.valorActual as number | null))
    } else {
      console.log('   ### FALLO inesperado:', (e as Error).message)
      process.exitCode = 1
    }
  }

  const CENTINELA = 12345
  console.log(`\n5) Escritura real (${CENTINELA}) y verificación...`)
  await actualizarContabilidad({
    anio: anioActual, categoriaClave: categoria.clave, mes: mesLibre,
    valor: CENTINELA, valorAnterior: original, usuario: 'prueba',
  })
  const tras = await traerPestania(hoja.gid)
  const leido = money(at(tras, pos.fila, pos.columna))
  console.log('   leído del sheet:', cop(leido), leido === CENTINELA ? '→ OK' : '→ ### NO COINCIDE ###')
  if (leido !== CENTINELA) process.exitCode = 1

  console.log('\n6) Restaurando la celda a como estaba...')
  await actualizarContabilidad({
    anio: anioActual, categoriaClave: categoria.clave, mes: mesLibre,
    valor: original, valorAnterior: CENTINELA, usuario: 'prueba',
  })
  const final = await traerPestania(hoja.gid)
  const restaurado = money(at(final, pos.fila, pos.columna))
  console.log('   valor final:', cop(restaurado),
    (restaurado ?? null) === (original ?? null) ? '→ restaurada' : '→ ### QUEDÓ DISTINTA, revisar a mano ###')
  if ((restaurado ?? null) !== (original ?? null)) process.exitCode = 1

  console.log('\n7) El total del año no cambió:')
  const despues = await obtenerGastosAgencia(true)
  const igual = despues.anios[anioActual].totalAnio === hoja.totalAnio
  console.log('   antes', cop(hoja.totalAnio), '· después', cop(despues.anios[anioActual].totalAnio), igual ? '→ OK' : '→ ### CAMBIÓ ###')
  if (!igual) process.exitCode = 1

  console.log(process.exitCode ? '\nHubo fallos, revisar arriba.' : '\nEscritura verificada de punta a punta.')
}

main().catch(e => { console.error('FALLO:', e instanceof Error ? e.message : e); process.exit(1) })
