/**
 * La cuenta de cobro en PDF, dibujada en el servidor.
 *
 * Una por persona y por semana: el sábado a las 23:59 el servidor reúne todos
 * los trabajos freelance aprobados de cada quien que sigan sin enviar y los
 * lista en UNA sola cuenta —cada trabajo con su valor, y el total al pie—
 * (decisión de Hotman, 22-ago). Antes el navegador dibujaba una cuenta por
 * trabajo y el servidor solo la archivaba; eso ya no existe: este es el único
 * dibujo, y lo que queda en Drive es exactamente esto.
 */

import { jsPDF } from 'jspdf'

export interface DatosPersona {
  nombreCompleto: string | null
  cedula: string | null
  ciudadExpedicion: string | null
  ciudad: string | null
  celular: string | null
  rut: string | null
  banco: string | null
  tipoCuenta: string | null
  numeroCuenta: string | null
  firmaUrl: string | null
}

export interface ItemCobro {
  concepto: string
  valor: number
}

export interface DatosCobro {
  /** Los trabajos de la semana, uno por renglón. */
  items: ItemCobro[]
  /** Día en que se emite: el del corte semanal. */
  fecha: Date
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const enLetra = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

const conIndicativo = (tel: string) => (tel.trim().startsWith('+') ? tel.trim() : `+57 ${tel.trim()}`)

const enPesos = (n: number) => '$' + n.toLocaleString('es-CO')

const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

/** El monto en palabras — sin esto la cuenta de cobro no es válida. */
function enPalabras(n: number): string {
  if (n === 0) return 'cero'
  if (n === 100) return 'cien'
  if (n < 30) return UNIDADES[n]
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10
    return DECENAS[d] + (u ? ` y ${UNIDADES[u]}` : '')
  }
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100
    return CENTENAS[c] + (r ? ` ${enPalabras(r)}` : '')
  }
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000), r = n % 1000
    const cabeza = miles === 1 ? 'mil' : `${enPalabras(miles)} mil`
    return cabeza + (r ? ` ${enPalabras(r)}` : '')
  }
  const millones = Math.floor(n / 1_000_000), r = n % 1_000_000
  const cabeza = millones === 1 ? 'un millón' : `${enPalabras(millones)} millones`
  return cabeza + (r ? ` ${enPalabras(r)}` : '')
}

/** Carga la firma desde Cloudinary como data URI para incrustarla. */
async function firmaComoDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') ?? 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

const totalDe = (cobro: DatosCobro) => cobro.items.reduce((s, i) => s + i.valor, 0)

export function nombreArchivo(persona: DatosPersona, cobro: DatosCobro): string {
  const quien = (persona.nombreCompleto ?? 'Sin nombre').replace(/[\\/:*?"<>|]/g, '').trim()
  const f = cobro.fecha
  const dia = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  return `${dia} ${quien} ${enPesos(totalDe(cobro))}.pdf`
}

export async function generarCuentaDeCobro(
  persona: DatosPersona,
  cobro: DatosCobro,
): Promise<{ pdf: Buffer; archivo: string }> {
  const total = totalDe(cobro)
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const margen = 25
  const util = ancho - margen * 2
  // La firma va anclada al pie de la última hoja y no a `y`: así queda a la
  // misma altura en todas las cuentas, por larga que sea la lista.
  const pie = alto - 55
  let y = 30

  // Con veinte trabajos en una semana la lista no cabe en una hoja: lo que no
  // quepa antes de la firma sigue en la siguiente.
  const asegurar = (alturaNecesaria: number) => {
    if (y + alturaNecesaria > pie - 10) {
      doc.addPage()
      y = 30
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('CUENTA DE COBRO', ancho / 2, y, { align: 'center' })

  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`${persona.ciudad ?? ''}, ${enLetra(cobro.fecha)}`, margen, y)

  y += 14
  doc.setFont('helvetica', 'bold')
  doc.text('GRUPO 500 S.A.S.', margen, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('DEBE A:', margen, y)

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(persona.nombreCompleto ?? '—', margen, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  const identificacion = [
    `C.C. ${persona.cedula ?? '—'}${persona.ciudadExpedicion ? ` de ${persona.ciudadExpedicion}` : ''}`,
    persona.rut ? `RUT ${persona.rut}` : null,
    persona.celular ? `Cel. ${conIndicativo(persona.celular)}` : null,
  ].filter(Boolean).join('  ·  ')
  doc.text(identificacion, margen, y)

  y += 14
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('LA SUMA DE:', margen, y)
  y += 7
  doc.setFontSize(13)
  doc.text(`${enPesos(total)} M/CTE`, margen, y)
  y += 6
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const letras = `(${enPalabras(total)} pesos m/cte)`
  doc.text(doc.splitTextToSize(letras.charAt(0).toUpperCase() + letras.slice(1), util), margen, y)

  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('POR CONCEPTO DE:', margen, y)
  y += 7

  // Un renglón por trabajo: el concepto a la izquierda (partido si es largo)
  // y su valor alineado a la derecha. El total cierra la lista.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  const anchoConcepto = util - 38
  for (const item of cobro.items) {
    const lineas = doc.splitTextToSize(`• ${item.concepto}`, anchoConcepto) as string[]
    const altura = lineas.length * 5.5 + 1.5
    asegurar(altura)
    doc.text(lineas, margen, y)
    doc.text(enPesos(item.valor), ancho - margen, y, { align: 'right' })
    y += altura
  }

  asegurar(14)
  y += 2
  doc.setDrawColor(120)
  doc.line(margen, y, ancho - margen, y)
  y += 6.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Total (${cobro.items.length} trabajo${cobro.items.length !== 1 ? 's' : ''})`, margen, y)
  doc.text(enPesos(total), ancho - margen, y, { align: 'right' })

  y += 12
  asegurar(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('FORMA DE PAGO:', margen, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  const cuenta = persona.tipoCuenta === 'CORRIENTE' ? 'corriente' : 'ahorros'
  doc.text(
    `Consignación a cuenta de ${cuenta} ${persona.banco ?? '—'} N° ${persona.numeroCuenta ?? '—'}, ` +
    `a nombre de ${persona.nombreCompleto ?? '—'}.`,
    margen, y, { maxWidth: util },
  )

  if (persona.firmaUrl) {
    const dataUri = await firmaComoDataUri(persona.firmaUrl)
    if (dataUri) {
      try { doc.addImage(dataUri, 'PNG', margen, pie - 20, 45, 18) } catch { /* firma ilegible: se omite */ }
    }
  }
  doc.setDrawColor(120)
  doc.line(margen, pie, margen + 75, pie)
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text(persona.nombreCompleto ?? '—', margen, pie + 6)
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`C.C. ${persona.cedula ?? '—'}`, margen, pie + 11)
  if (persona.celular) doc.text(`Cel. ${conIndicativo(persona.celular)}`, margen, pie + 16)

  return {
    pdf: Buffer.from(doc.output('arraybuffer')),
    archivo: nombreArchivo(persona, cobro),
  }
}
