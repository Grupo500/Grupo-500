// Prueba del servicio de gastos de agencia contra el sheet real.
// Uso: GASTOS_AGENCIA_SHEET_ID=... npx tsx scripts/probar-gastos-agencia.ts

import { obtenerGastosAgencia, gastosAgenciaConfigurado } from '../src/services/gastosAgencia'

const cop = (n: number | null) => n == null
  ? '—'
  : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

async function main() {
  if (!gastosAgenciaConfigurado()) {
    console.error('Falta GASTOS_AGENCIA_SHEET_ID en el entorno')
    process.exit(1)
  }

  const d = await obtenerGastosAgencia(true)
  console.log('leidoEn:', d.leidoEn)
  console.log('avisos :', d.avisos.length ? d.avisos : '(ninguno)')

  for (const [anio, a] of Object.entries(d.anios).sort()) {
    console.log(`\n=== ${anio} === categorías=${a.categorias.length} mesesConDato=[${a.mesesConDato.join(',')}]`)
    for (const c of a.categorias) {
      console.log('  ', c.nombre.padEnd(38).slice(0, 38), '|', c.clave.padEnd(26),
        '|', c.valores.map(v => (v == null ? '·' : (v / 1e6).toFixed(1))).join(' '))
    }
    console.log('   total del sheet :', cop(a.totalAnio))
    const sumado = a.totalPorMes.reduce<number>((s, v) => s + (v || 0), 0)
    console.log('   suma por meses  :', cop(sumado), sumado === a.totalAnio ? '→ CUADRA' : '→ ### NO CUADRA ###')
    console.log('   descuadres      :', a.descuadre.length ? a.descuadre : '(ninguno)')
  }

  console.log('\n=== PRODUCCIÓN ===')
  for (const [k, b] of Object.entries(d.produccion)) {
    console.log(` ${k}: "${b.titulo}" · año=${b.anio} · ${b.tipos.length} tipos`)
  }

  console.log('\n=== TARIFARIO ===')
  for (const [k, b] of Object.entries(d.tarifario)) {
    const secciones = [...new Set(b.items.map(i => i.seccion))]
    console.log(` ${k}: ${b.items.length} items · total ${cop(b.total)} · secciones ${JSON.stringify(secciones)}`)
  }

  console.log('\n=== NÓMINA ===')
  console.log(' corte  :', JSON.stringify(d.nomina.corte))
  console.log(' resumen:', d.nomina.resumen)
  console.log(' muestra:', JSON.stringify(d.nomina.personas.slice(0, 3), null, 1))

  console.log('\n=== CUENTAS ===')
  console.log(' total:', d.cuentas.total, '| por banco:', d.cuentas.porBanco)

  // Nada de PII: ni cédulas ni cuentas completas pueden viajar en la respuesta.
  const texto = JSON.stringify(d)
  const cuentas = [...d.nomina.personas, ...[]].map(p => p.cuenta)
  const malas = cuentas.filter(c => c && !c.startsWith('••••'))
  const cedulas = texto.match(/"\d{6,12}"/g) ?? []
  console.log('\n=== CHEQUEO PII ===')
  console.log(' cuentas sin enmascarar:', malas.length ? malas : '(ninguna)')
  console.log(' strings de 6-12 dígitos:', cedulas.length ? cedulas.slice(0, 8) : '(ninguno)')
  console.log(' ¿aparece la palabra cédula en el payload?:', /c[eé]dula/i.test(texto))

  // La caché debe evitar una segunda lectura
  const t0 = Date.now()
  await obtenerGastosAgencia()
  console.log('\nsegunda llamada (caché):', Date.now() - t0, 'ms')
}

main().catch(e => { console.error('FALLO:', e); process.exit(1) })
