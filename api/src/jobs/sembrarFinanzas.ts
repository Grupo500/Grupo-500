/**
 * Siembra los precios oficiales y rellena cupón y afiliado en los pagos que ya
 * estaban en la base.
 *
 * Dry-run por defecto. Con --aplicar escribe.
 *   npx tsx src/jobs/sembrarFinanzas.ts
 *   npx tsx src/jobs/sembrarFinanzas.ts --aplicar
 */
import { prisma } from '../config/prisma'

const APLICAR = process.argv.includes('--aplicar')
const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

/** Fecha desde la que rige el primer precio: el inicio del modelo. */
const VIGENCIA_INICIAL = new Date((process.env.FINANZAS_FECHA_INICIO ?? '2026-01-01') + 'T00:00:00')

async function sembrarPrecios() {
  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, precio: true, preciosOficiales: { select: { id: true } } },
    orderBy: { nombre: 'asc' },
  })

  const pendientes = cursos.filter(c => c.preciosOficiales.length === 0 && c.precio > 0)
  const sinPrecio = cursos.filter(c => c.precio <= 0)

  console.log('── Precios oficiales ─────────────────────────')
  console.log('Cursos activos      :', cursos.length)
  console.log('Ya tienen historial :', cursos.length - pendientes.length - sinPrecio.length)
  console.log('Se van a sembrar    :', pendientes.length)
  console.log('Sin precio de lista :', sinPrecio.length, sinPrecio.length ? '(se omiten)' : '')

  for (const c of pendientes.slice(0, 8)) {
    console.log('  ', c.nombre.slice(0, 52).padEnd(52), cop(c.precio))
  }
  if (pendientes.length > 8) console.log('   ... y', pendientes.length - 8, 'más')

  if (APLICAR && pendientes.length) {
    await prisma.precioOficial.createMany({
      data: pendientes.map(c => ({
        cursoId: c.id,
        precio: c.precio,
        vigenteDesde: VIGENCIA_INICIAL,
        nota: 'Sembrado desde el precio de lista del curso',
      })),
      skipDuplicates: true,
    })
    console.log('   → sembrados con vigencia', VIGENCIA_INICIAL.toISOString().slice(0, 10))
  }

  if (sinPrecio.length) {
    console.log('   Aviso: estos cursos no tienen precio de lista, así que la')
    console.log('   desviación de precio no se puede calcular para ellos:')
    for (const c of sinPrecio.slice(0, 5)) console.log('    -', c.nombre)
  }
}

/**
 * Cupón y nombre del afiliado quedaron sin guardar durante meses. Los postbacks
 * crudos sí están desde que se empezó a registrarlos, así que se recuperan de
 * ahí para los pagos que coincidan por transacción.
 */
async function rellenarDesdePostbacks() {
  const logs = await prisma.hotmartWebhookLog.findMany({
    where: { transaccion: { not: null } },
    select: { transaccion: true, payload: true },
  })

  console.log('')
  console.log('── Cupón y afiliado desde los postbacks ──────')
  console.log('Postbacks guardados :', logs.length)

  let conCupon = 0
  let conAfiliado = 0
  const cambios: { referencia: string; cupon: string | null; afiliado: string | null }[] = []

  for (const l of logs) {
    const p = l.payload as any
    const compra = p?.data?.purchase
    const cupon = compra?.offer?.coupon_code ?? compra?.coupon_code ?? null
    const afiliado = p?.data?.affiliates?.[0]?.affiliate_name?.trim() || null
    if (!cupon && !afiliado) continue
    if (cupon) conCupon++
    if (afiliado) conAfiliado++
    cambios.push({ referencia: l.transaccion!, cupon, afiliado })
  }

  console.log('Con cupón           :', conCupon)
  console.log('Con nombre afiliado :', conAfiliado)

  if (APLICAR && cambios.length) {
    let escritos = 0
    for (const c of cambios) {
      const r = await prisma.pago.updateMany({
        where: { referenciaPago: c.referencia },
        data: {
          ...(c.cupon ? { cupon: c.cupon } : {}),
          ...(c.afiliado ? { afiliadoHotmart: c.afiliado } : {}),
        },
      })
      escritos += r.count
    }
    console.log('   → pagos actualizados:', escritos)
  }
}

/** Cuántas ventas quedarían sin dueño y con qué nombres de afiliado. */
async function revisarAtribucion() {
  const sinAsesor = await prisma.pago.findMany({
    where: { estado: 'PAGADO', asesorId: null },
    select: { afiliadoHotmart: true },
  })
  const total = await prisma.pago.count({ where: { estado: 'PAGADO' } })

  const porNombre = new Map<string, number>()
  let sinNombre = 0
  for (const p of sinAsesor) {
    if (!p.afiliadoHotmart) { sinNombre++; continue }
    porNombre.set(p.afiliadoHotmart, (porNombre.get(p.afiliadoHotmart) ?? 0) + 1)
  }

  console.log('')
  console.log('── Atribución ────────────────────────────────')
  console.log('Pagos sin asesor    :', sinAsesor.length, 'de', total,
    '(' + ((sinAsesor.length / Math.max(1, total)) * 100).toFixed(1) + '%)')
  console.log('Con nombre por homologar:', porNombre.size, 'nombres distintos')
  console.log('Sin nombre de afiliado  :', sinNombre, '(venta directa o postback antiguo)')
  for (const [nombre, n] of [...porNombre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log('  ', nombre.slice(0, 40).padEnd(40), n, 'pagos')
  }
}

async function main() {
  console.log(APLICAR ? '### MODO APLICAR ###' : '### Simulación (usa --aplicar para escribir) ###')
  console.log('')
  await sembrarPrecios()
  await rellenarDesdePostbacks()
  await revisarAtribucion()

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
