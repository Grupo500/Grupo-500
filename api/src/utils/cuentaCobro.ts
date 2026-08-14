/**
 * Los datos fijos de una cuenta de cobro y qué le falta a cada quien.
 *
 * Vive aparte porque lo consultan dos sitios que no se conocen: Ajustes —para
 * decirle a la persona qué le falta— y Cobros —para avisarle al líder antes de
 * aprobar algo que después no se va a poder pagar. Tener la lista en un solo
 * lugar evita que una pantalla diga "completo" y la otra "falta el banco".
 */

export interface DatosFinancieros {
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

/** Campo → cómo se le nombra a la persona cuando falta. */
const REQUERIDOS: [keyof DatosFinancieros, string][] = [
  ['nombreCompleto',   'tu nombre completo'],
  ['cedula',           'tu cédula'],
  ['ciudadExpedicion', 'la ciudad de expedición'],
  ['ciudad',           'tu ciudad'],
  ['celular',          'tu celular'],
  ['rut',              'tu RUT'],
  ['banco',            'el banco'],
  ['tipoCuenta',       'el tipo de cuenta'],
  ['numeroCuenta',     'el número de cuenta'],
  ['firmaUrl',         'tu firma'],
]

const vacio = (v: unknown) => v == null || String(v).trim() === ''

export function datosFinancierosDe(m: Partial<DatosFinancieros>) {
  const datos: DatosFinancieros = {
    nombreCompleto:   m.nombreCompleto   ?? null,
    cedula:           m.cedula           ?? null,
    ciudadExpedicion: m.ciudadExpedicion ?? null,
    ciudad:           m.ciudad           ?? null,
    celular:          m.celular          ?? null,
    rut:              m.rut              ?? null,
    banco:            m.banco            ?? null,
    tipoCuenta:       m.tipoCuenta       ?? null,
    numeroCuenta:     m.numeroCuenta     ?? null,
    firmaUrl:         m.firmaUrl         ?? null,
  }
  const falta = REQUERIDOS.filter(([k]) => vacio(datos[k])).map(([, etiqueta]) => etiqueta)
  return { ...datos, falta, completos: falta.length === 0 }
}

/** Las columnas que hay que traer de la base para armar lo anterior. */
export const SELECT_FINANCIEROS = {
  nombreCompleto: true, cedula: true, ciudadExpedicion: true, ciudad: true,
  celular: true, rut: true, banco: true, tipoCuenta: true, numeroCuenta: true,
  firmaUrl: true,
} as const
