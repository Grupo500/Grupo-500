// Prueba EN SECO de los localizadores de celda de gastos de agencia.
//
// No escribe nada. Para cada valor editable ubica su celda y comprueba que lo
// que hay ahí es exactamente lo que el parser reportó. Si un localizador
// apuntara a otra celda, una edición desde la app corrompería la contabilidad.
//
// Uso: GASTOS_AGENCIA_SHEET_ID=... npx tsx scripts/probar-ubicacion-gastos.ts

import {
  obtenerGastosAgencia, traerPestania, at, money, num, GIDS,
} from '../src/services/gastosAgencia'
import {
  ubicarContabilidad, ubicarNomina, ubicarProduccion, ubicarTarifario,
} from '../src/services/gastosAgenciaEscritura'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

let ok = 0
let fallos = 0

function comprobar(etiqueta: string, esperado: unknown, encontrado: unknown) {
  const igual = (esperado ?? null) === (encontrado ?? null)
  if (igual) { ok++; return }
  fallos++
  console.log(`  ### DESCUADRE ### ${etiqueta}: el parser dice ${JSON.stringify(esperado)} y en la celda ubicada hay ${JSON.stringify(encontrado)}`)
}

const letra = (i: number) => {
  let n = i + 1, s = ''
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26) }
  return s
}

async function main() {
  const snap = await obtenerGastosAgencia(true)

  // ── contabilidad ──
  for (const [anio, hoja] of Object.entries(snap.anios)) {
    const rows = await traerPestania(hoja.gid)
    console.log(`\n=== Contabilidad ${anio} (gid=${hoja.gid}) ===`)
    let celdas = 0
    for (const c of hoja.categorias) {
      for (let mes = 0; mes < 12; mes++) {
        const esperado = c.valores[mes]
        let pos
        try { pos = ubicarContabilidad(rows, c.clave, mes) } catch (e) {
          // Solo es un fallo si el parser sí tenía un valor ahí.
          if (esperado != null) { fallos++; console.log(`  ### no ubiqué ${c.clave}/${MESES[mes]}: ${(e as Error).message}`) }
          continue
        }
        comprobar(`${c.nombre} · ${MESES[mes]}`, esperado, money(at(rows, pos.fila, pos.columna)))
        celdas++
        if (c === hoja.categorias[0] && mes === 0) {
          console.log(`  primera celda: ${c.nombre}/${MESES[mes]} → ${letra(pos.columna)}${pos.fila + 1}`)
        }
      }
    }
    console.log(`  ${celdas} celdas verificadas`)
  }

  // ── nómina ──
  console.log('\n=== Nómina ===')
  {
    const rows = await traerPestania(GIDS.nomina)
    const u = ubicarNomina(rows)
    console.log(`  encabezado en fila ${u.filaHeader + 1} · ${u.filas.length} personas`)
    console.log(`  columnas: nombre=${letra(u.cNombre)} banco=${letra(u.cBanco)} monto=${letra(u.cMonto)} pago=${letra(u.cPago)}`)
    comprobar('cantidad de personas', snap.nomina.personas.length, u.filas.length)

    snap.nomina.personas.forEach((p, i) => {
      const fila = u.filas[i]
      if (fila == null) { fallos++; console.log(`  ### falta la fila ${i}`); return }
      comprobar(`nombre[${i}]`, p.nombre, at(rows, fila, u.cNombre))
      comprobar(`monto de ${p.nombre}`, p.monto || null, money(at(rows, fila, u.cMonto)))
      comprobar(`pago de ${p.nombre}`, p.pagado, at(rows, fila, u.cPago).toUpperCase().startsWith('S'))
      comprobar(`banco de ${p.nombre}`, p.banco, at(rows, fila, u.cBanco).replace(/\s+/g, ' ').trim())
    })
  }

  // ── producción ──
  console.log('\n=== Producción ===')
  {
    const rows = await traerPestania(GIDS.actual)
    for (const b of Object.values(snap.produccion)) {
      for (const t of b.tipos) {
        for (let mes = 0; mes < 12; mes++) {
          const esperado = t.valores[mes]
          let pos
          try { pos = ubicarProduccion(rows, b.titulo, t.nombre, mes) } catch {
            if (esperado != null) { fallos++; console.log(`  ### no ubiqué ${b.titulo}/${t.nombre}/${MESES[mes]}`) }
            continue
          }
          comprobar(`${t.nombre} · ${MESES[mes]}`, esperado, num(at(rows, pos.fila, pos.columna)))
        }
      }
      console.log(`  «${b.titulo}»: ${b.tipos.length} tipos verificados`)
    }
  }

  // ── tarifario ──
  console.log('\n=== Tarifario ===')
  {
    const rows = await traerPestania(GIDS.actual)
    for (const [clave, b] of Object.entries(snap.tarifario)) {
      for (const it of b.items) {
        let pos
        try { pos = ubicarTarifario(rows, clave as 'salarios' | 'videos' | 'ediciones', it.concepto) } catch (e) {
          fallos++; console.log(`  ### no ubiqué ${clave}/${it.concepto}: ${(e as Error).message}`); continue
        }
        comprobar(`${clave} · ${it.concepto}`, it.valor, money(at(rows, pos.fila, pos.columna)))
      }
      console.log(`  «${clave}»: ${b.items.length} conceptos verificados`)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${ok} coincidencias · ${fallos} descuadres`)
  if (fallos) {
    console.log('HAY DESCUADRES: un localizador apunta a la celda equivocada, NO habilitar la edición.')
    process.exit(1)
  }
  console.log('Todos los localizadores apuntan a la celda correcta.')
}

main().catch(e => { console.error('FALLO:', e); process.exit(1) })
