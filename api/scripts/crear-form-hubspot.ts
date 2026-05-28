/**
 * Script único para crear el formulario de inscripción en HubSpot.
 * Ejecutar: npx tsx scripts/crear-form-hubspot.ts
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

const prisma   = new PrismaClient()
const HS_API   = 'https://api.hubapi.com'
const API_KEY  = process.env.HUBSPOT_API_KEY ?? ''
const PORTAL   = process.env.HUBSPOT_PORTAL_ID ?? ''

function headers() {
  return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
}

async function ensureProperty(prop: {
  name: string; label: string; type: string; fieldType: string; groupName?: string
  options?: { label: string; value: string; displayOrder: number }[]
}) {
  const check = await fetch(`${HS_API}/crm/v3/properties/contacts/${prop.name}`, { headers: headers() })
  if (check.ok) { console.log(`  ✓ Propiedad ya existe: ${prop.name}`); return }

  const res = await fetch(`${HS_API}/crm/v3/properties/contacts`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      name: prop.name, label: prop.label, type: prop.type,
      fieldType: prop.fieldType, groupName: prop.groupName ?? 'contactinformation',
      ...(prop.options ? { options: prop.options } : {}),
    }),
  })
  if (res.ok) console.log(`  ✅ Propiedad creada: ${prop.name}`)
  else {
    const err = await res.json()
    console.log(`  ⚠️  Error en ${prop.name}:`, JSON.stringify(err).slice(0, 100))
  }
}

async function main() {
  console.log('\n🔑 HubSpot Portal ID:', PORTAL)
  console.log('🔑 API Key:', API_KEY ? `${API_KEY.slice(0, 15)}...` : '⚠️  NO ENCONTRADA')

  if (!API_KEY || !PORTAL) {
    console.error('\n❌ Faltan HUBSPOT_API_KEY o HUBSPOT_PORTAL_ID en el .env')
    process.exit(1)
  }

  // ── 1. Obtener cursos activos ──────────────────────────────────────────────
  const cursosActivos = await prisma.curso.findMany({
    where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true },
  })
  console.log(`\n📚 Cursos activos: ${cursosActivos.length}`)

  const cursoOptions = cursosActivos.length > 0
    ? cursosActivos.map((c, i) => ({ label: c.nombre, value: `curso_${c.id}`, displayOrder: i }))
    : [{ label: 'Curso Pre-ICFES Grupo 500', value: 'curso_general', displayOrder: 0 }]

  // ── 2. Crear propiedades personalizadas ────────────────────────────────────
  console.log('\n🏗️  Creando propiedades personalizadas en HubSpot CRM...')
  const props = [
    { name: 'tipo_documento',         label: 'Tipo de Documento',        type: 'enumeration', fieldType: 'select',
      options: [
        { label: 'Tarjeta de Identidad (TI)', value: 'TI', displayOrder: 0 },
        { label: 'Cédula de Ciudadanía (CC)', value: 'CC', displayOrder: 1 },
        { label: 'Cédula de Extranjería (CE)', value: 'CE', displayOrder: 2 },
        { label: 'Pasaporte',                  value: 'PA', displayOrder: 3 },
      ] },
    { name: 'numero_documento',       label: 'Número de Documento',       type: 'string', fieldType: 'text' },
    { name: 'fecha_nacimiento_g500',  label: 'Fecha de Nacimiento',       type: 'string', fieldType: 'text' },
    { name: 'colegio_g500',           label: 'Colegio',                   type: 'string', fieldType: 'text' },
    { name: 'grado_g500',             label: 'Grado',                     type: 'enumeration', fieldType: 'select',
      options: [
        { label: '10°',                      value: '10',       displayOrder: 0 },
        { label: '11°',                      value: '11',       displayOrder: 1 },
        { label: 'Egresado (ya me gradué)',   value: 'egresado', displayOrder: 2 },
      ] },
    { name: 'nombre_acudiente',       label: 'Nombre del Acudiente',      type: 'string', fieldType: 'text' },
    { name: 'telefono_acudiente',     label: 'Teléfono del Acudiente',    type: 'string', fieldType: 'text' },
    { name: 'parentesco_acudiente',   label: 'Parentesco del Acudiente',  type: 'string', fieldType: 'text' },
    { name: 'tipo_doc_acudiente',     label: 'Tipo Doc. Acudiente',       type: 'string', fieldType: 'text' },
    { name: 'num_doc_acudiente',      label: 'Núm. Doc. Acudiente',       type: 'string', fieldType: 'text' },
    { name: 'primer_icfes',           label: '¿Primer ICFES?',            type: 'enumeration', fieldType: 'select',
      options: [
        { label: 'Sí', value: 'si', displayOrder: 0 },
        { label: 'No', value: 'no', displayOrder: 1 },
      ] },
    { name: 'puntaje_anterior_icfes', label: 'Puntaje Anterior ICFES',    type: 'string', fieldType: 'text' },
    { name: 'carrera_interes',        label: 'Carrera de Interés',        type: 'string', fieldType: 'text' },
    { name: 'universidad_interes',    label: 'Universidad de Interés',    type: 'string', fieldType: 'text' },
    { name: 'curso_grupo500',         label: 'Curso Grupo 500',           type: 'enumeration', fieldType: 'select',
      options: cursoOptions },
    { name: 'monto_consignado',       label: 'Monto Consignado',          type: 'number', fieldType: 'number' },
    { name: 'cuenta_pago',            label: 'Cuenta de Pago',            type: 'string', fieldType: 'text' },
    { name: 'como_conocio_g500',      label: '¿Cómo nos conoció?',        type: 'string', fieldType: 'text' },
  ]

  for (const prop of props) {
    await ensureProperty(prop)
  }

  // ── 3. Crear formulario ────────────────────────────────────────────────────
  console.log('\n📝 Creando formulario en HubSpot...')

  function field(name: string, label: string, type: string, fieldType: string, required = true, options?: any[], placeholder = '') {
    return {
      fields: [{
        name, label, type, fieldType, required, enabled: true, hidden: false,
        placeholder, defaultValue: '',
        ...(options ? { options } : {}),
      }],
      default: true, isSmartGroup: false,
    }
  }

  const formPayload = {
    name:        `Inscripción Grupo 500 — ${new Date().toLocaleDateString('es-CO')}`,
    submitText:  '¡Inscribirme ahora!',
    inlineMessage: '¡Listo! Ya eres parte de Grupo 500 🚀 En breve te contactamos por WhatsApp.',
    formFieldGroups: [
      // Datos del estudiante
      field('firstname',            '¿Cuál es tu nombre(s)?',                         'string',      'text',   true, undefined, 'Tus nombres'),
      field('lastname',             '¿Cuál es tu apellido(s)?',                        'string',      'text',   true, undefined, 'Tus apellidos'),
      field('email',                'Correo electrónico (Gmail)',                       'string',      'text',   true, undefined, 'correo@gmail.com'),
      field('phone',                '¿Cuál es tu número de celular?',                  'string',      'phonenumber', true, undefined, 'Tu celular'),
      field('tipo_documento',       '¿Cuál es tu tipo de documento?',                  'enumeration', 'select', true,
        [
          { label: 'Tarjeta de Identidad (TI)', value: 'TI', displayOrder: 0 },
          { label: 'Cédula de Ciudadanía (CC)', value: 'CC', displayOrder: 1 },
          { label: 'Cédula de Extranjería (CE)', value: 'CE', displayOrder: 2 },
          { label: 'Pasaporte',                  value: 'PA', displayOrder: 3 },
        ]),
      field('numero_documento',     '¿Cuál es tu número de documento?',                'string',      'text',   true, undefined, 'Número de documento'),
      field('fecha_nacimiento_g500','¿Cuál es tu fecha de nacimiento?',                'string',      'text',   true, undefined, 'DD/MM/AAAA'),
      field('colegio_g500',         '¿En qué colegio estudias o estudiaste?',          'string',      'text',   true, undefined, 'Nombre completo del colegio'),
      field('grado_g500',           '¿En qué grado estás actualmente?',                'enumeration', 'select', true,
        [
          { label: '10°',                    value: '10',       displayOrder: 0 },
          { label: '11°',                    value: '11',       displayOrder: 1 },
          { label: 'Egresado (ya me gradué)', value: 'egresado', displayOrder: 2 },
        ]),
      field('city',                 '¿En qué ciudad vives?',                           'string',      'text',   true, undefined, 'Bucaramanga'),
      field('state',                '¿En qué departamento vives?',                     'string',      'text',   true, undefined, 'Santander'),
      // Acudiente
      field('nombre_acudiente',     '¿Nombre completo de tu acudiente?',               'string',      'text',   true, undefined, 'Mamá, papá o responsable'),
      field('parentesco_acudiente', '¿Qué parentesco tiene contigo?',                  'string',      'text',   true, undefined, 'Mamá / Papá / Tutor...'),
      field('telefono_acudiente',   '¿Celular del acudiente?',                         'string',      'text',   true, undefined, 'Número de celular del acudiente'),
      field('tipo_doc_acudiente',   '¿Tipo de documento del acudiente?',               'string',      'text',   false, undefined, 'CC / CE / Otro'),
      field('num_doc_acudiente',    '¿Número de documento del acudiente?',             'string',      'text',   false, undefined, 'Número de documento'),
      // Académico
      field('primer_icfes',         '¿Es tu primer ICFES?',                            'enumeration', 'select', true,
        [
          { label: 'Sí, es mi primer ICFES',             value: 'si', displayOrder: 0 },
          { label: 'No, ya lo he presentado antes',      value: 'no', displayOrder: 1 },
        ]),
      field('puntaje_anterior_icfes', 'Si ya presentaste el ICFES, ¿cuánto sacaste?', 'string',      'text',   false, undefined, 'Escribe N/A si es tu primer ICFES'),
      field('carrera_interes',      '¿A qué carrera quieres ingresar?',                'string',      'text',   true, undefined, 'Medicina, Ingeniería, Derecho...'),
      field('universidad_interes',  '¿A qué universidad quisieras ingresar?',          'string',      'text',   true, undefined, 'UIS, UNAB, UNAL...'),
      // Curso y pago
      field('curso_grupo500',       '¿Qué curso adquiriste?',                          'enumeration', 'select', true, cursoOptions),
      field('monto_consignado',     '¿Cuánto dinero consignaste? (solo números)',       'number',      'number', true),
      field('cuenta_pago',          '¿A qué cuenta realizaste el pago?',               'string',      'text',   true, undefined, 'Bancolombia — GRUPO 500 EDUCACION S.A.S'),
      // Marketing
      field('como_conocio_g500',    '¿Cómo te enteraste de Grupo 500?',                'string',      'text',   true, undefined, 'Instagram, TikTok, referido por un amigo...'),
    ],
  }

  const formRes = await fetch(`${HS_API}/forms/v2/forms`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify(formPayload),
  })

  if (!formRes.ok) {
    const err = await formRes.json()
    console.error('\n❌ Error al crear formulario:', JSON.stringify(err, null, 2))
    process.exit(1)
  }

  const form = await formRes.json() as { guid: string; portalId: number }
  const formUrl = `https://grupo-500.vercel.app/inscripcion`

  // ── 4. Guardar en BD ───────────────────────────────────────────────────────
  await Promise.all([
    prisma.configApp.upsert({
      where: { clave: 'hubspot_form_guid' },
      update: { valor: form.guid },
      create: { clave: 'hubspot_form_guid', valor: form.guid },
    }),
    prisma.configApp.upsert({
      where: { clave: 'hubspot_form_url' },
      update: { valor: formUrl },
      create: { clave: 'hubspot_form_url', valor: formUrl },
    }),
    prisma.configApp.upsert({
      where: { clave: 'hubspot_portal_id' },
      update: { valor: PORTAL },
      create: { clave: 'hubspot_portal_id', valor: PORTAL },
    }),
  ])

  console.log('\n✅ ¡Formulario creado exitosamente!')
  console.log(`   GUID:    ${form.guid}`)
  console.log(`   URL:     ${formUrl}`)
  console.log(`   Portal:  ${PORTAL}`)
  console.log('\n👉 El formulario ya está activo en el dashboard.')
}

main()
  .catch(err => { console.error('❌ Error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
