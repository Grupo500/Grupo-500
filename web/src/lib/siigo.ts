import ExcelJS from 'exceljs'

// Réplica del "Modelo de importación de comprobantes contables" de Siigo.
// Las 27 columnas, sus anchos y los dos colores de encabezado salen del
// archivo que entrega Siigo: rojo los campos obligatorios, azul los demás.
// Si Siigo cambia su modelo, esta tabla es lo único que hay que actualizar.

const ROJO = 'FFFF0000' // obligatorio
const AZUL = 'FF0070C0' // opcional

export interface ColumnaSiigo {
  clave: string
  titulo: string
  ancho: number | null // null = sin ancho explícito, como en el modelo
  obligatorio: boolean
}

// Ojo: dos títulos traen espacios finales en el modelo original ("Fecha de
// elaboración ", "Base gravable libro compras/ventas  "). Se conservan tal
// cual: es una réplica, no una corrección.
export const COLUMNAS_SIIGO: ColumnaSiigo[] = [
  { clave: 'tipoComprobante', titulo: 'Tipo de comprobante', ancho: 13.14, obligatorio: true },
  { clave: 'consecutivoComprobante', titulo: 'Consecutivo comprobante', ancho: 13.57, obligatorio: true },
  { clave: 'fechaElaboracion', titulo: 'Fecha de elaboración ', ancho: 11.43, obligatorio: true },
  { clave: 'siglaMoneda', titulo: 'Sigla moneda', ancho: 8.71, obligatorio: false },
  { clave: 'tasaCambio', titulo: 'Tasa de cambio', ancho: 14.57, obligatorio: false },
  { clave: 'codigoCuenta', titulo: 'Código cuenta contable', ancho: 17, obligatorio: true },
  { clave: 'identificacionTercero', titulo: 'Identificación tercero', ancho: 14.14, obligatorio: true },
  { clave: 'sucursal', titulo: 'Sucursal', ancho: 11.43, obligatorio: false },
  { clave: 'codigoProducto', titulo: 'Código producto', ancho: 11.43, obligatorio: false },
  { clave: 'codigoBodega', titulo: 'Código de bodega', ancho: 11.86, obligatorio: false },
  { clave: 'accion', titulo: 'Acción', ancho: 9.71, obligatorio: false },
  { clave: 'cantidadProducto', titulo: 'Cantidad producto', ancho: 9, obligatorio: false },
  { clave: 'prefijo', titulo: 'Prefijo', ancho: 11.86, obligatorio: false },
  { clave: 'consecutivo', titulo: 'Consecutivo', ancho: 13.29, obligatorio: false },
  { clave: 'numeroCuota', titulo: 'No. cuota', ancho: 12.43, obligatorio: false },
  { clave: 'fechaVencimiento', titulo: 'Fecha vencimiento', ancho: 12.14, obligatorio: false },
  { clave: 'codigoImpuesto', titulo: 'Código impuesto', ancho: 13.86, obligatorio: false },
  { clave: 'codigoGrupoActivoFijo', titulo: 'Código grupo activo fijo', ancho: 11.43, obligatorio: false },
  { clave: 'codigoActivoFijo', titulo: 'Código activo fijo', ancho: 25.57, obligatorio: false },
  { clave: 'descripcion', titulo: 'Descripción', ancho: 14.43, obligatorio: false },
  { clave: 'centroCostos', titulo: 'Código centro/subcentro de costos', ancho: 23.29, obligatorio: false },
  { clave: 'debito', titulo: 'Débito', ancho: 17.86, obligatorio: false },
  { clave: 'credito', titulo: 'Crédito', ancho: 20.43, obligatorio: false },
  { clave: 'observaciones', titulo: 'Observaciones', ancho: 17.14, obligatorio: false },
  { clave: 'baseGravable', titulo: 'Base gravable libro compras/ventas  ', ancho: 17.86, obligatorio: false },
  { clave: 'baseExenta', titulo: 'Base exenta libro compras/ventas', ancho: 17.14, obligatorio: false },
  // El modelo la deja en el default de Excel; aquí va explícita con ese mismo
  // valor porque el default de esta hoja es 9 (ver libroSiigo).
  { clave: 'mesCierre', titulo: 'Mes de cierre', ancho: 10.71, obligatorio: false },
]

/** Una fila del comprobante. Las claves que no se llenen quedan vacías. */
export type FilaSiigo = Partial<Record<string, string | number>>

/** Límites que impone el modelo en los campos de texto libre. */
export const LARGO_DESCRIPCION = 100
export const LARGO_OBSERVACIONES = 300

export function recortar(texto: string, largo: number): string {
  return texto.length <= largo ? texto : `${texto.slice(0, largo - 1)}…`
}

/** Fecha en el formato DD/MM/AAAA que exige el modelo. */
export function fechaSiigo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Arma el libro con la hoja "Datos", el encabezado con los colores del modelo
 * y las filas del comprobante. Devuelve el .xlsx listo para descargar.
 */
export async function libroSiigo(filas: FilaSiigo[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Datos')

  // exceljs decide con su propio default interno (9) qué columna omite del XML,
  // sin mirar el de la hoja: la columna L, que en el modelo mide justo 9, nunca
  // llega a declararse. Por eso el default de la hoja se fija en 9 —así la L se
  // dibuja a 9 aunque venga heredada— y a cambio la última columna, que el
  // modelo deja en el default de Excel (baseColWidth 10 → 10.71), sí se declara.
  // El resultado en pantalla es el del modelo en las 27; lo que cambia es cuál
  // viene declarada y cuál heredada.
  hoja.properties.defaultColWidth = 9

  hoja.columns = COLUMNAS_SIIGO.map(c => ({ key: c.clave, width: c.ancho ?? undefined }))

  const encabezado = hoja.addRow(COLUMNAS_SIIGO.map(c => c.titulo))
  COLUMNAS_SIIGO.forEach((c, i) => {
    const celda = encabezado.getCell(i + 1)
    celda.font = { name: 'Calibri', size: 11, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.obligatorio ? ROJO : AZUL } }
  })

  for (const fila of filas) {
    const r = hoja.addRow(COLUMNAS_SIIGO.map(c => fila[c.clave] ?? ''))
    r.font = { name: 'Calibri', size: 11 }
  }

  const buffer = await libro.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
