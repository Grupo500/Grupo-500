import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { broadcast } from '../utils/sseManager'

const router  = Router()
const HS_API  = 'https://api.hubapi.com'

function hsHeaders() {
  return {
    Authorization:  `Bearer ${process.env.HUBSPOT_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ── Crear propiedades personalizadas en HubSpot (idempotente) ─────────────────
async function ensureProperty(prop: {
  name: string; label: string; type: string; fieldType: string
  groupName?: string; options?: { label: string; value: string; displayOrder: number }[]
}) {
  const res = await fetch(`${HS_API}/crm/v3/properties/contacts/${prop.name}`, {
    headers: hsHeaders(),
  })
  if (res.ok) return // ya existe

  await fetch(`${HS_API}/crm/v3/properties/contacts`, {
    method:  'POST',
    headers: hsHeaders(),
    body: JSON.stringify({
      name:       prop.name,
      label:      prop.label,
      type:       prop.type,
      fieldType:  prop.fieldType,
      groupName:  prop.groupName ?? 'contactinformation',
      ...(prop.options ? { options: prop.options } : {}),
    }),
  })
}

async function ensureCustomProperties(cursoOptions: { label: string; value: string }[]) {
  const props = [
    { name: 'tipo_documento',          label: 'Tipo de Documento',        type: 'enumeration', fieldType: 'select',
      options: [
        { label: 'Tarjeta de Identidad (TI)', value: 'TI', displayOrder: 0 },
        { label: 'Cédula de Ciudadanía (CC)', value: 'CC', displayOrder: 1 },
        { label: 'Cédula de Extranjería (CE)', value: 'CE', displayOrder: 2 },
        { label: 'Pasaporte',                  value: 'PA', displayOrder: 3 },
      ] },
    { name: 'numero_documento',        label: 'Número de Documento',      type: 'string',      fieldType: 'text' },
    { name: 'fecha_nacimiento_g500',   label: 'Fecha de Nacimiento',      type: 'string',      fieldType: 'text' },
    { name: 'colegio_g500',            label: 'Colegio',                  type: 'string',      fieldType: 'text' },
    { name: 'grado_g500',              label: 'Grado',                    type: 'enumeration', fieldType: 'select',
      options: [
        { label: '10°',      value: '10',       displayOrder: 0 },
        { label: '11°',      value: '11',       displayOrder: 1 },
        { label: 'Egresado', value: 'egresado', displayOrder: 2 },
      ] },
    { name: 'nombre_acudiente',        label: 'Nombre del Acudiente',     type: 'string',      fieldType: 'text' },
    { name: 'telefono_acudiente',      label: 'Teléfono del Acudiente',   type: 'string',      fieldType: 'text' },
    { name: 'parentesco_acudiente',    label: 'Parentesco del Acudiente', type: 'string',      fieldType: 'text' },
    { name: 'tipo_doc_acudiente',      label: 'Tipo Doc. Acudiente',      type: 'string',      fieldType: 'text' },
    { name: 'num_doc_acudiente',       label: 'Núm. Doc. Acudiente',      type: 'string',      fieldType: 'text' },
    { name: 'primer_icfes',            label: '¿Primer ICFES?',           type: 'enumeration', fieldType: 'select',
      options: [
        { label: 'Sí', value: 'si', displayOrder: 0 },
        { label: 'No', value: 'no', displayOrder: 1 },
      ] },
    { name: 'puntaje_anterior_icfes',  label: 'Puntaje Anterior ICFES',   type: 'string',      fieldType: 'text' },
    { name: 'carrera_interes',         label: 'Carrera de Interés',       type: 'string',      fieldType: 'text' },
    { name: 'interes_premedico',       label: 'Interés Premédico',        type: 'string',      fieldType: 'text' },
    { name: 'universidad_interes',     label: 'Universidad de Interés',   type: 'string',      fieldType: 'text' },
    { name: 'curso_grupo500',          label: 'Curso Grupo 500',          type: 'enumeration', fieldType: 'select',
      options: cursoOptions.map((c, i) => ({ label: c.label, value: c.value, displayOrder: i })) },
    { name: 'monto_consignado',        label: 'Monto Consignado',         type: 'number',      fieldType: 'number' },
    { name: 'cuenta_pago',             label: 'Cuenta de Pago',           type: 'string',      fieldType: 'text' },
    { name: 'como_conocio_g500',       label: '¿Cómo nos conoció?',       type: 'string',      fieldType: 'text' },
  ]

  await Promise.allSettled(props.map(ensureProperty))
}

// ── Crear formulario en HubSpot ───────────────────────────────────────────────
router.post('/crear-formulario', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const cursosActivos = await prisma.curso.findMany({
    where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true },
  })

  const cursoOptions = cursosActivos.length > 0
    ? cursosActivos.map(c => ({ label: c.nombre, value: `curso_${c.id}` }))
    : [{ label: 'Curso Pre-ICFES Grupo 500', value: 'curso_general' }]

  // Crear propiedades personalizadas si no existen
  await ensureCustomProperties(cursoOptions)
  logger.info('[HubSpot] Propiedades personalizadas verificadas')

  const formPayload = {
    name:       `Inscripción Grupo 500 — ${new Date().toLocaleDateString('es-CO')}`,
    submitText: '¡Inscribirme ahora!',
    inlineMessage: '¡Listo! Ya eres parte de Grupo 500 🚀 En breve te contactamos.',
    formFieldGroups: [
      // ── DATOS DEL ESTUDIANTE ────────────────────────────────────────────────
      { fields: [{ name: 'firstname', label: 'Nombre(s)', type: 'string', fieldType: 'text', required: true, placeholder: 'Tus nombres' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'lastname',  label: 'Apellidos', type: 'string', fieldType: 'text', required: true, placeholder: 'Tus apellidos' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'email', label: 'Correo electrónico (Gmail)', type: 'string', fieldType: 'text', required: true, placeholder: 'correo@gmail.com' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'phone', label: 'Número de celular', type: 'string', fieldType: 'text', required: true, placeholder: 'Tu celular' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'tipo_documento', label: '¿Cuál es tu tipo de documento?', type: 'enumeration', fieldType: 'select', required: true,
          options: [
            { label: 'Tarjeta de Identidad (TI)', value: 'TI', displayOrder: 0 },
            { label: 'Cédula de Ciudadanía (CC)', value: 'CC', displayOrder: 1 },
            { label: 'Cédula de Extranjería (CE)', value: 'CE', displayOrder: 2 },
            { label: 'Pasaporte', value: 'PA', displayOrder: 3 },
          ] }], default: true, isSmartGroup: false },
      { fields: [{ name: 'numero_documento', label: 'Número de documento', type: 'string', fieldType: 'text', required: true, placeholder: 'Tu número de documento' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'fecha_nacimiento_g500', label: 'Fecha de nacimiento', type: 'string', fieldType: 'text', required: true, placeholder: 'DD/MM/AAAA' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'colegio_g500', label: '¿En qué colegio estudias o estudiaste?', type: 'string', fieldType: 'text', required: true, placeholder: 'Nombre completo del colegio' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'grado_g500', label: '¿En qué grado estás?', type: 'enumeration', fieldType: 'select', required: true,
          options: [
            { label: '10°',                   value: '10',       displayOrder: 0 },
            { label: '11°',                   value: '11',       displayOrder: 1 },
            { label: 'Egresado (ya me gradué)', value: 'egresado', displayOrder: 2 },
          ] }], default: true, isSmartGroup: false },
      { fields: [{ name: 'city',  label: 'Ciudad', type: 'string', fieldType: 'text', required: true, placeholder: 'Bucaramanga' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'state', label: 'Departamento', type: 'string', fieldType: 'text', required: true, placeholder: 'Santander' }], default: true, isSmartGroup: false },
      // ── DATOS DEL ACUDIENTE ─────────────────────────────────────────────────
      { fields: [{ name: 'nombre_acudiente', label: 'Nombre completo del acudiente', type: 'string', fieldType: 'text', required: true, placeholder: 'Mamá, papá o responsable' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'parentesco_acudiente', label: 'Parentesco del acudiente', type: 'string', fieldType: 'text', required: true, placeholder: 'Mamá / Papá / Tutor...' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'telefono_acudiente', label: 'Celular del acudiente', type: 'string', fieldType: 'text', required: true, placeholder: 'Número de celular del acudiente' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'tipo_doc_acudiente', label: 'Tipo de documento del acudiente', type: 'string', fieldType: 'text', required: false, placeholder: 'CC / CE / Otro' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'num_doc_acudiente', label: 'Número de documento del acudiente', type: 'string', fieldType: 'text', required: false, placeholder: 'Número de documento' }], default: true, isSmartGroup: false },
      // ── INFORMACIÓN ACADÉMICA ───────────────────────────────────────────────
      { fields: [{ name: 'primer_icfes', label: '¿Es tu primer ICFES?', type: 'enumeration', fieldType: 'select', required: true,
          options: [
            { label: 'Sí, es mi primer ICFES', value: 'si', displayOrder: 0 },
            { label: 'No, ya lo he presentado antes', value: 'no', displayOrder: 1 },
          ] }], default: true, isSmartGroup: false },
      { fields: [{ name: 'puntaje_anterior_icfes', label: 'Si ya presentaste el ICFES, ¿cuánto sacaste?', type: 'string', fieldType: 'text', required: false, placeholder: 'Escribe N/A si es tu primer ICFES' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'carrera_interes', label: '¿A qué carrera quieres ingresar?', type: 'string', fieldType: 'text', required: true, placeholder: 'Medicina, Ingeniería...' }], default: true, isSmartGroup: false },
      { fields: [{ name: 'universidad_interes', label: '¿A qué universidad quisieras ingresar?', type: 'string', fieldType: 'text', required: true, placeholder: 'UIS, UNAB, UNAL...' }], default: true, isSmartGroup: false },
      // ── CURSO Y PAGO ────────────────────────────────────────────────────────
      { fields: [{ name: 'curso_grupo500', label: '¿Qué curso adquiriste?', type: 'enumeration', fieldType: 'select', required: true,
          options: cursoOptions.map((c, i) => ({ label: c.label, value: c.value, displayOrder: i })) }], default: true, isSmartGroup: false },
      { fields: [{ name: 'monto_consignado', label: '¿Cuánto dinero consignaste? (solo números)', type: 'number', fieldType: 'number', required: true }], default: true, isSmartGroup: false },
      { fields: [{ name: 'cuenta_pago', label: '¿A qué cuenta realizaste el pago?', type: 'string', fieldType: 'text', required: true, placeholder: 'Bancolombia — GRUPO 500 EDUCACION S.A.S' }], default: true, isSmartGroup: false },
      // ── MARKETING ───────────────────────────────────────────────────────────
      { fields: [{ name: 'como_conocio_g500', label: '¿Cómo te enteraste de Grupo 500?', type: 'string', fieldType: 'text', required: true, placeholder: 'Instagram, TikTok, referido...' }], default: true, isSmartGroup: false },
    ],
  }

  const response = await fetch(`${HS_API}/forms/v2/forms`, {
    method:  'POST',
    headers: hsHeaders(),
    body:    JSON.stringify(formPayload),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    logger.error({ err }, '[HubSpot] Error creando formulario')
    return res.status(500).json({ error: 'Error al crear formulario en HubSpot', details: err })
  }

  const form = await response.json() as { guid: string; portalId: number }
  const portalId = process.env.HUBSPOT_PORTAL_ID ?? String(form.portalId)
  const formUrl  = `${process.env.NEXT_PUBLIC_URL ?? 'https://grupo-500.vercel.app'}/inscripcion`

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
      update: { valor: portalId },
      create: { clave: 'hubspot_portal_id', valor: portalId },
    }),
  ])

  logger.info(`[HubSpot] Formulario creado: ${form.guid}`)
  return ApiResponse.created(res, { guid: form.guid, url: formUrl, cursos: cursosActivos.length })
}))

// ── Formulario activo ─────────────────────────────────────────────────────────
router.get('/formulario-activo', asyncHandler(async (_req, res) => {
  const [cfgUrl, cfgGuid, cfgPortal] = await Promise.all([
    prisma.configApp.findUnique({ where: { clave: 'hubspot_form_url'  } }),
    prisma.configApp.findUnique({ where: { clave: 'hubspot_form_guid' } }),
    prisma.configApp.findUnique({ where: { clave: 'hubspot_portal_id' } }),
  ])
  return ApiResponse.success(res, {
    url:      cfgUrl?.valor   ?? null,
    formGuid: cfgGuid?.valor  ?? null,
    portalId: cfgPortal?.valor ?? process.env.HUBSPOT_PORTAL_ID ?? null,
  })
}))

// ── Eliminar formulario activo ────────────────────────────────────────────────
router.delete('/formulario-activo', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  await prisma.configApp.deleteMany({
    where: { clave: { in: ['hubspot_form_guid', 'hubspot_form_url', 'hubspot_portal_id'] } },
  })
  return ApiResponse.success(res, { message: 'Formulario activo eliminado. Ya puedes generar uno nuevo.' })
}))

// ── Webhook — recibir envíos del formulario HubSpot ───────────────────────────
// Configurar en HubSpot → Automatización → Flujos de trabajo:
//   Trigger: Formulario enviado → Acción: Enviar webhook → URL de este endpoint
router.post('/webhook', asyncHandler(async (req, res) => {
  const payload = req.body

  // HubSpot Workflow webhook payload: { objectId, properties: { email: { value } } }
  // HubSpot Form submission API:      { values: [{ name, value }] }
  let fields: Record<string, string> = {}

  if (payload?.properties) {
    // Formato Workflow
    for (const [key, val] of Object.entries(payload.properties as Record<string, any>)) {
      fields[key] = val?.value ?? ''
    }
  } else if (Array.isArray(payload?.values)) {
    // Formato Submissions API
    for (const v of payload.values) {
      fields[v.name] = v.value ?? ''
    }
  } else if (Array.isArray(payload?.fields)) {
    // Formato alternativo
    for (const v of payload.fields) {
      fields[v.name] = v.value ?? ''
    }
  } else {
    return res.status(400).json({ error: 'Payload de HubSpot no reconocido' })
  }

  const get = (k: string) => fields[k]?.trim() ?? ''

  try {
    const email = get('email')
    if (!email) return res.status(400).json({ error: 'Email requerido' })

    // ── Idempotencia ─────────────────────────────────────────────────────────
    const existente = await prisma.estudiante.findFirst({ where: { email } })
    if (existente) {
      logger.info(`[HubSpot webhook] Estudiante ya existe: ${existente.id}`)
      const monto = parseMonto(get('monto_consignado'))
      if (monto > 0) {
        await prisma.pago.create({
          data: {
            estudianteId:     existente.id,
            monto,
            estado:           'PENDIENTE',
            fechaVencimiento: new Date(),
            metodo:           'Bancolombia',
            notas:            `Pago adicional vía HubSpot. Cuenta: ${get('cuenta_pago')}`,
          },
        })
      }
      return res.status(200).json({ message: 'Estudiante ya registrado — pago adicional procesado', estudianteId: existente.id })
    }

    // ── Buscar o crear colegio ───────────────────────────────────────────────
    const nombreColegio = get('colegio_g500')
    let colegioId: string | undefined
    if (nombreColegio) {
      let colegio = await prisma.colegio.findFirst({
        where: { nombre: { equals: nombreColegio, mode: 'insensitive' } },
      })
      if (!colegio) {
        colegio = await prisma.colegio.create({
          data: { nombre: nombreColegio, ciudad: get('city') },
        })
      }
      colegioId = colegio.id
    }

    // ── Crear estudiante ─────────────────────────────────────────────────────
    const nombre = `${get('firstname')} ${get('lastname')}`.trim()
    const fechaNacRaw = get('fecha_nacimiento_g500')
    const fechaNacimiento = parseFecha(fechaNacRaw)

    const estudiante = await prisma.estudiante.create({
      data: {
        nombre,
        email,
        telefono:       get('phone'),
        fechaNacimiento,
        tipoDocumento:  get('tipo_documento') || 'TI',
        documento:      get('numero_documento'),
        grado:          get('grado_g500'),
        ciudad:         get('city'),
        departamento:   get('state'),
        primerIcfes:    get('primer_icfes') === 'si',
        puntajeAnterior: get('puntaje_anterior_icfes') || 'N/A',
        carreraInteres: get('carrera_interes'),
        universidadInteres: get('universidad_interes'),
        colegioId,
        acudiente: get('nombre_acudiente') ? {
          create: {
            nombre:          get('nombre_acudiente'),
            telefono:        get('telefono_acudiente'),
            relacion:        get('parentesco_acudiente') || 'Otro',
            tipoDocumento:   get('tipo_doc_acudiente') || 'CC',
            numeroDocumento: get('num_doc_acudiente'),
          },
        } : undefined,
      },
    })

    // ── Asignar curso ────────────────────────────────────────────────────────
    const cursoVal = get('curso_grupo500')
    let cursoId: string | undefined
    if (cursoVal && cursoVal !== 'curso_general') {
      cursoId = cursoVal.replace('curso_', '')
      await prisma.cursoEstudiante.create({
        data: { estudianteId: estudiante.id, cursoId, descuentoPorcentaje: 0 },
      }).catch(() => {}) // ignorar si el curso no existe
    }

    // ── Registrar fuente de marketing ────────────────────────────────────────
    const fuente = get('como_conocio_g500')
    if (fuente) {
      await prisma.fuenteContacto.create({
        data: {
          estudianteId: estudiante.id,
          fuente,
          formId:       'hubspot',
          respondedAt:  new Date(),
        },
      }).catch(() => {})
    }

    // ── Registrar pago ───────────────────────────────────────────────────────
    const monto = parseMonto(get('monto_consignado'))
    if (monto > 0) {
      await prisma.pago.create({
        data: {
          estudianteId:     estudiante.id,
          monto,
          estado:           'PENDIENTE',
          fechaVencimiento: new Date(),
          metodo:           'Bancolombia',
          notas:            `Inscripción vía HubSpot. Cuenta: ${get('cuenta_pago')}`,
        },
      })
    }

    // ── Notificar SSE ────────────────────────────────────────────────────────
    broadcast('nuevo-estudiante', { id: estudiante.id, nombre, email })

    logger.info(`[HubSpot webhook] Estudiante creado: ${estudiante.id} — ${nombre}`)
    return res.status(200).json({
      message:      'Inscripción procesada correctamente',
      estudianteId: estudiante.id,
      cursoAsignado: !!cursoId,
      pagoRegistrado: monto > 0,
    })

  } catch (error: any) {
    logger.error({ err: error }, '[HubSpot webhook] Error procesando inscripción')
    return res.status(500).json({ error: 'Error procesando inscripción', details: error.message })
  }
}))

// ── Procesar respuestas (polling manual) ─────────────────────────────────────
router.post('/procesar-respuestas', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const cfg = await prisma.configApp.findUnique({ where: { clave: 'hubspot_form_guid' } })
  if (!cfg?.valor) {
    return res.status(400).json({ error: 'No hay formulario activo. Crea uno primero.' })
  }

  const apiUrl = process.env.API_URL
    ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    ?? 'https://api-production-79572.up.railway.app'

  const subRes = await fetch(
    `${HS_API}/form-integrations/v1/submissions/forms/${cfg.valor}?limit=100`,
    { headers: hsHeaders() }
  )

  if (!subRes.ok) {
    return res.status(502).json({ error: 'No se pudieron obtener las respuestas de HubSpot' })
  }

  const data    = await subRes.json() as { results: any[] }
  const items   = data.results ?? []
  let procesados = 0
  let omitidos   = 0

  for (const item of items) {
    try {
      const r = await fetch(`${apiUrl}/api/hubspot/webhook`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ values: item.values }),
      })
      const json = await r.json() as any
      if (json?.message?.includes('ya registrado')) omitidos++
      else procesados++
    } catch { omitidos++ }
  }

  return ApiResponse.success(res, { total: items.length, procesados, omitidos })
}))

// ── Sincronizar estudiante al CRM de HubSpot ──────────────────────────────────
// Llamar desde el controlador de estudiantes cuando se crea uno manualmente
export async function syncEstudianteHubspot(estudiante: {
  id: string; nombre: string; email: string; telefono: string
  ciudad?: string | null; departamento?: string | null
  cursos?: { curso: { nombre: string; precio: number } }[]
  asesor?: { nombre: string } | null
}) {
  if (!process.env.HUBSPOT_API_KEY) return

  try {
    const [firstname, ...rest] = estudiante.nombre.split(' ')
    const lastname = rest.join(' ')
    const curso    = estudiante.cursos?.[0]

    // Crear o actualizar contacto
    const contactRes = await fetch(`${HS_API}/crm/v3/objects/contacts`, {
      method:  'POST',
      headers: hsHeaders(),
      body: JSON.stringify({
        properties: {
          email:      estudiante.email,
          firstname,
          lastname,
          phone:      estudiante.telefono,
          city:       estudiante.ciudad  ?? '',
          state:      estudiante.departamento ?? '',
          ...(curso ? { curso_grupo500: curso.curso.nombre } : {}),
        },
      }),
    })

    if (!contactRes.ok) {
      // Si ya existe, actualizar por email
      const searchRes = await fetch(`${HS_API}/crm/v3/objects/contacts/search`, {
        method:  'POST',
        headers: hsHeaders(),
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: estudiante.email }] }],
        }),
      })
      const searchData = await searchRes.json() as { results: { id: string }[] }
      const contactId  = searchData.results?.[0]?.id
      if (contactId) {
        await fetch(`${HS_API}/crm/v3/objects/contacts/${contactId}`, {
          method:  'PATCH',
          headers: hsHeaders(),
          body: JSON.stringify({
            properties: { firstname, lastname, phone: estudiante.telefono },
          }),
        })
      }
      return
    }

    const contact = await contactRes.json() as { id: string }

    // Crear deal si tiene curso
    if (curso) {
      await fetch(`${HS_API}/crm/v3/objects/deals`, {
        method:  'POST',
        headers: hsHeaders(),
        body: JSON.stringify({
          properties: {
            dealname:   `${estudiante.nombre} — ${curso.curso.nombre}`,
            amount:     curso.curso.precio,
            dealstage:  'appointmentscheduled',
            pipeline:   'default',
            closedate:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          associations: [{
            to:    { id: contact.id },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
          }],
        }),
      })
    }

    logger.info(`[HubSpot CRM] Contacto sincronizado: ${estudiante.email}`)
  } catch (err) {
    logger.error({ err }, '[HubSpot CRM] Error sincronizando contacto')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseMonto(raw: unknown): number {
  if (!raw) return 0
  const limpio = String(raw).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const n = parseFloat(limpio)
  return isNaN(n) ? 0 : Math.round(n)
}

function parseFecha(raw: string): Date {
  if (!raw) return new Date('2000-01-01')
  // Soporta DD/MM/AAAA y AAAA-MM-DD
  if (raw.includes('/')) {
    const [d, m, y] = raw.split('/')
    return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`)
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date('2000-01-01') : d
}

export default router
