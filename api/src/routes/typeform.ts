import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { broadcast } from '../utils/sseManager'

const router = Router()
const TYPEFORM_API = 'https://api.typeform.com'

function typeformHeaders() {
  return {
    'Authorization': `Bearer ${process.env.TYPEFORM_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ── Helper: configurar webhook en un formulario Typeform ──────────────────────
async function configurarWebhook(formId: string): Promise<{ ok: boolean; mensaje: string }> {
  const apiUrl =
    process.env.API_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ??
    'https://api-production-79572.up.railway.app'  // fallback conocido

  const webhookUrl = `${apiUrl}/api/typeform/webhook`

  const res = await fetch(`${TYPEFORM_API}/forms/${formId}/webhooks/inscripcion`, {
    method: 'PUT',
    headers: typeformHeaders(),
    body: JSON.stringify({
      url:     webhookUrl,
      enabled: true,
      verify_ssl: true,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    logger.error({ err }, `Error configurando webhook para form ${formId}`)
    return { ok: false, mensaje: `Error Typeform al configurar webhook: ${res.status}` }
  }

  logger.info(`Webhook configurado en form ${formId} → ${webhookUrl}`)
  return { ok: true, mensaje: `Webhook activo → ${webhookUrl}` }
}

// ── Crear formulario de inscripción en Typeform ──────────────────────────────
router.post('/crear-formulario', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  // Traer cursos activos de la BD para generar las opciones dinámicamente
  const cursosActivos = await prisma.curso.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, precio: true },
  })

  const cursoChoices = cursosActivos.map(c => ({
    ref: `curso_${c.id}`,
    label: c.nombre,   // Sin precio — el estudiante digita lo que pagó (puede haber promo)
  }))

  // Si no hay cursos aún, agregar opción genérica
  if (cursoChoices.length === 0) {
    cursoChoices.push({ ref: 'curso_general', label: 'Curso Pre-ICFES Grupo 500' })
  }

  const formPayload = {
    title: 'Formulario de Inscripción - Grupo 500',
    settings: {
      language: 'es',
      progress_bar: 'percentage',
      show_progress_bar: true,
      meta: {
        title: 'Inscripción Grupo 500 - Curso Pre-ICFES',
        description: 'Formulario de inscripción para el curso de preparación ICFES de Grupo 500.',
      },
    },
    welcome_screens: [
      {
        ref: 'bienvenida',
        title: '¡Bienvenido a Grupo 500! 🎯',
        properties: {
          description: '¡Solo te tomará 5 minutos! Completa este formulario con tus datos y queda oficialmente inscrito. ¡Tus datos están seguros con nosotros! 🔒',
          show_button: true,
          button_text: '¡Empecemos!',
        },
      },
    ],
    thankyou_screens: [
      {
        ref: 'gracias',
        title: '¡Listo! Ya eres parte de Grupo 500 🚀',
        properties: {
          description: '¡Tu inscripción fue recibida exitosamente! En breve te contactaremos para confirmar tu pago y darte acceso al grupo de WhatsApp. ¡Vamos con toda!',
          show_button: false,
        },
      },
    ],
    fields: [
      // ── PASO 1: DATOS DEL ESTUDIANTE ─────────────────────────────────────
      {
        ref: 'nombres_apellidos',
        title: '¿Cuál es tu nombre completo?',
        type: 'short_text',
        validations: { required: true },
        properties: { description: 'Escribe tus nombres y apellidos completos.' },
      },
      {
        ref: 'email_google',
        title: '¿Cuál es tu correo electrónico de Google? (@gmail.com)',
        type: 'email',
        validations: { required: true },
        properties: { description: 'Por este correo te daremos acceso a los simulacros, talleres y clases grabadas.' },
      },
      {
        ref: 'celular_estudiante',
        title: '¿Cuál es tu número de celular?',
        type: 'phone_number',
        validations: { required: true },
        properties: { description: 'Este número será el único que agregaremos al grupo de WhatsApp. ¡Asegúrate de que quede bien escrito!' },
      },
      {
        ref: 'tipo_documento_estudiante',
        title: '¿Cuál es tu tipo de documento de identidad?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'ti',       label: 'Tarjeta de Identidad (TI)' },
            { ref: 'cc',       label: 'Cédula de Ciudadanía (CC)' },
            { ref: 'ce',       label: 'Cédula de Extranjería (CE)' },
            { ref: 'pa',       label: 'Pasaporte' },
            { ref: 'otro_doc', label: 'Otro' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'numero_documento_estudiante',
        title: '¿Cuál es tu número de documento?',
        type: 'short_text',
        validations: { required: true },
      },
      {
        ref: 'fecha_nacimiento',
        title: '¿Cuál es tu fecha de nacimiento?',
        type: 'date',
        validations: { required: true },
        properties: { description: 'Formato: día / mes / año' },
      },
      // ── NOTA: edad se calcula automáticamente en el servidor desde fecha_nacimiento ──
      {
        ref: 'colegio',
        title: '¿En qué colegio estudias o estudiaste?',
        type: 'short_text',
        validations: { required: true },
        properties: { description: 'Escribe el nombre completo del colegio.' },
      },
      {
        ref: 'grado',
        title: '¿En qué grado estás actualmente?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'grado_10', label: '10°' },
            { ref: 'grado_11', label: '11°' },
            { ref: 'egresado', label: 'Ya me gradué (egresado)' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'ciudad_residencia',
        title: '¿En qué ciudad y departamento vives?',
        type: 'short_text',
        validations: { required: true },
        properties: { description: 'Ejemplo: Bucaramanga, Santander.' },
      },
      // ── PASO 2: DATOS DEL ACUDIENTE ──────────────────────────────────────
      {
        ref: 'nombres_acudiente',
        title: '¿Cuál es el nombre completo de tu acudiente?',
        type: 'short_text',
        validations: { required: true },
        properties: { description: 'Nombres y apellidos completos de mamá, papá u otro responsable.' },
      },
      {
        ref: 'parentesco_acudiente',
        title: '¿Cuál es el parentesco de tu acudiente contigo?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'mama',           label: 'Mamá' },
            { ref: 'papa',           label: 'Papá' },
            { ref: 'otro_parentesco', label: 'Otro' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: true,
        },
      },
      {
        ref: 'celular_acudiente',
        title: '¿Cuál es el número de celular del acudiente?',
        type: 'phone_number',
        validations: { required: true },
        properties: { description: 'Este número NO será agregado al grupo de WhatsApp pero lo tenemos como respaldo.' },
      },
      {
        ref: 'tipo_documento_acudiente',
        title: '¿Cuál es el tipo de documento del acudiente?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'cc_acudiente',  label: 'Cédula de Ciudadanía (CC)' },
            { ref: 'ce_acudiente',  label: 'Cédula de Extranjería / Pasaporte' },
            { ref: 'otro_doc_acudiente', label: 'Otro' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'numero_documento_acudiente',
        title: '¿Cuál es el número de documento del acudiente?',
        type: 'short_text',
        validations: { required: true },
      },
      // ── PASO 3: INFORMACIÓN ACADÉMICA ────────────────────────────────────
      {
        ref: 'primer_icfes',
        title: '¿Es tu primer ICFES?',
        type: 'yes_no',
        validations: { required: true },
      },
      {
        ref: 'puntaje_anterior',
        title: 'Si ya presentaste el ICFES antes, ¿cuánto sacaste en tu última prueba?',
        type: 'short_text',
        validations: { required: true },
        properties: { description: 'Si nunca lo has presentado escribe N/A.' },
      },
      {
        ref: 'carrera_interes',
        title: '¿A qué carrera quieres ingresar?',
        type: 'long_text',
        validations: { required: true },
        properties: { description: 'Si no estás seguro, escribe las dos carreras que más te llaman la atención.' },
      },
      {
        ref: 'interes_salud',
        title: '¿Te interesa estudiar alguna carrera del área de la salud?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          description: 'Medicina, Microbiología, Enfermería, Fisioterapia, Nutrición, Odontología, Psicología u otras.',
          choices: [
            { ref: 'si_salud',  label: 'Sí, quiero estudiar una carrera de la salud' },
            { ref: 'no_salud',  label: 'No, mi carrera no es del área de la salud' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'interes_premedico',
        title: '¿Te gustaría inscribirte en nuestro curso Premédico?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          description: 'Anatomía, Fisiología, Histología, Bioquímica y Biología Celular explicadas desde cero. Tienes precio especial por ser parte de Grupo 500.',
          choices: [
            { ref: 'si_premedico',      label: 'Sí, mándame la información' },
            { ref: 'tal_vez_premedico', label: 'Tal vez, si me gusta el preicfes me inscribo' },
            { ref: 'tal_vez_dinero',    label: 'Tal vez, ahorita no tengo el dinero pero en un futuro miramos' },
            { ref: 'no_premedico',      label: 'No, mi carrera no necesita esos conocimientos' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'universidad_interes',
        title: '¿A qué universidad quisieras ingresar?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'uis',        label: 'Universidad Industrial de Santander UIS' },
            { ref: 'unab',       label: 'Universidad Autónoma de Bucaramanga UNAB' },
            { ref: 'pamplona',   label: 'Universidad de Pamplona' },
            { ref: 'unal',       label: 'Universidad Nacional de Colombia UNAL' },
            { ref: 'javeriana',  label: 'Universidad Javeriana' },
            { ref: 'pontificia', label: 'Universidad Pontificia Bolivariana' },
            { ref: 'udea',       label: 'Universidad de Antioquia UDEA' },
            { ref: 'univalle',   label: 'Universidad del Valle UNIVALLE' },
            { ref: 'uptc',       label: 'Universidad Pedagógica y Tecnológica UPTC' },
            { ref: 'libre',      label: 'Universidad Libre' },
            { ref: 'cartagena',  label: 'Universidad de Cartagena' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: true,
        },
      },
      // ── PASO 4: CURSO Y PAGO ─────────────────────────────────────────────
      {
        ref: 'curso_seleccionado',
        title: '¿Qué curso adquiriste?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          description: 'Selecciona el curso por el que realizaste tu pago.',
          choices: cursoChoices,
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      {
        ref: 'cuenta_pago',
        title: '¿A qué cuenta realizaste el pago?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'bancolombia', label: 'Bancolombia - GRUPO 500 EDUCACION S.A.S' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: true,
        },
      },
      {
        ref: 'monto_consignado',
        title: '¿Cuánto dinero consignaste?',
        type: 'short_text',
        validations: { required: true },
        properties: {
          description: 'Escribe el valor exacto que consignaste. Ejemplo: 600.000 o 300.000',
        },
      },
      // TODO: cambiar type a 'file_upload' cuando se adquiera plan de pago en Typeform
      {
        ref: 'comprobante_pago',
        title: '¿Tienes el comprobante de tu pago? Pega aquí el link 🔗',
        type: 'short_text',
        validations: { required: false },
        properties: {
          description: 'Sube la foto o PDF a Google Drive, WhatsApp Web o cualquier servicio y pega el enlace aquí. Si no tienes el link ahora, puedes enviarlo después por WhatsApp.',
        },
      },
      // ── PASO 5: MARKETING ─────────────────────────────────────────────────
      {
        ref: 'como_conocio',
        title: '¿Cómo te enteraste de Grupo 500?',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'ig_video_link',   label: 'Vi un video con link a WhatsApp en Instagram' },
            { ref: 'ig_perfil',       label: 'Vi un video en Instagram y escribí al perfil o número del video' },
            { ref: 'tiktok_link',     label: 'Vi un video con link a WhatsApp en TikTok' },
            { ref: 'tiktok_perfil',   label: 'Vi un video en TikTok y escribí al perfil o número del video' },
            { ref: 'fb_link',         label: 'Vi un video con link a WhatsApp en Facebook' },
            { ref: 'fb_perfil',       label: 'Vi un video en Facebook y escribí al perfil o número del video' },
            { ref: 'youtube',         label: 'Vi un anuncio en YouTube y le di clic' },
            { ref: 'google',          label: 'Los encontré en el buscador de Google' },
            { ref: 'referido',        label: 'Me lo recomendó un amigo, familiar o conocido' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: true,
        },
      },
      // ── TÉRMINOS Y CONDICIONES ─────────────────────────────────────────────
      {
        ref: 'terminos',
        title: 'Términos y condiciones del curso',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          description: 'Lee los términos y condiciones antes de continuar: https://drive.google.com/file/d/11uAceAG_244vinKAA4WWZL8ng49q8v11/view',
          choices: [
            { ref: 'mayor_acepta', label: 'Soy mayor de edad y acepto los términos y condiciones' },
            { ref: 'menor_acepta', label: 'Soy menor de edad y mi acudiente ha leído y aceptado los términos y condiciones' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
      // ── CONFIRMACIÓN FINAL ─────────────────────────────────────────────────
      {
        ref: 'confirmacion',
        title: '¿Preparado para empezar? Al enviar quedas oficialmente inscrito en Grupo 500.',
        type: 'multiple_choice',
        validations: { required: true },
        properties: {
          choices: [
            { ref: 'vamos',         label: '¡Vamos con toda!' },
            { ref: 'obvio',         label: '¡Obvio!' },
            { ref: 'eso_se_sabe',   label: '¡Eso se sabe!' },
            { ref: 'claro',         label: 'Claroooooooooooooo' },
            { ref: 'asi_es',        label: '¡Así es!' },
            { ref: 'efectivamente', label: 'Efectivamente' },
          ],
          allow_multiple_selection: false,
          allow_other_choice: false,
        },
      },
    ],
  }

  const response = await fetch(`${TYPEFORM_API}/forms`, {
    method: 'POST',
    headers: typeformHeaders(),
    body: JSON.stringify(formPayload),
  })

  if (!response.ok) {
    const error: unknown = await response.json()
    logger.error({ err: error }, 'Error creando formulario Typeform')
    return res.status(500).json({ error: 'Error al crear formulario en Typeform', details: error })
  }

  const form = await response.json() as { id: string }
  const formUrl = `https://form.typeform.com/to/${form.id}`
  logger.info(`Formulario Typeform creado: ${form.id} con ${cursosActivos.length} curso(s)`)

  // Persistir el form activo en ConfigApp
  await Promise.all([
    prisma.configApp.upsert({
      where: { clave: 'typeform_form_id' },
      update: { valor: form.id },
      create: { clave: 'typeform_form_id', valor: form.id },
    }),
    prisma.configApp.upsert({
      where: { clave: 'typeform_form_url' },
      update: { valor: formUrl },
      create: { clave: 'typeform_form_url', valor: formUrl },
    }),
  ])

  // Configurar webhook automáticamente en el formulario recién creado
  const webhookResult = await configurarWebhook(form.id)

  return ApiResponse.created(res, {
    id:             form.id,
    url:            formUrl,
    cursos:         cursosActivos.length,
    webhookActivo:  webhookResult.ok,
    webhookMsg:     webhookResult.mensaje,
    message:        'Formulario creado exitosamente en Typeform',
  })
}))

// ── Formulario activo (para todos los roles autenticados) ────────────────────
// Retorna el URL del formulario vigente.
// Si no hay registro en ConfigApp, consulta la API de Typeform para sincronizar
// automáticamente el formulario más reciente que exista en la cuenta.
router.get('/formulario-activo', authenticate, asyncHandler(async (_req, res) => {
  const [cfgUrl, cfgId] = await Promise.all([
    prisma.configApp.findUnique({ where: { clave: 'typeform_form_url' } }),
    prisma.configApp.findUnique({ where: { clave: 'typeform_form_id'  } }),
  ])

  // 1. Tenemos URL guardada → retornar directo
  if (cfgUrl?.valor) {
    return ApiResponse.success(res, { url: cfgUrl.valor })
  }

  // 2. Tenemos el ID pero no la URL → reconstruir y persistir
  if (cfgId?.valor) {
    const url = `https://form.typeform.com/to/${cfgId.valor}`
    await prisma.configApp.upsert({
      where: { clave: 'typeform_form_url' },
      update: { valor: url },
      create: { clave: 'typeform_form_url', valor: url },
    })
    return ApiResponse.success(res, { url })
  }

  // 3. ConfigApp vacío → consultar API de Typeform para auto-sincronizar
  if (!process.env.TYPEFORM_API_KEY) {
    return ApiResponse.success(res, { url: null })
  }

  try {
    const resp = await fetch(`${TYPEFORM_API}/forms?page_size=10&sort_by=created_at&order_by=desc`, {
      headers: typeformHeaders(),
    })

    if (!resp.ok) {
      logger.warn('No se pudo consultar Typeform al buscar formulario activo')
      return ApiResponse.success(res, { url: null })
    }

    const json = await resp.json() as { items?: { id: string; title: string }[] }
    const forms = json.items ?? []

    // Buscar el formulario de inscripción de Grupo 500 (por título)
    const formActivo = forms.find(f =>
      f.title.toLowerCase().includes('inscripción') ||
      f.title.toLowerCase().includes('grupo 500') ||
      f.title.toLowerCase().includes('inscripcion')
    ) ?? forms[0]  // Si no coincide por título, usar el más reciente

    if (!formActivo) {
      return ApiResponse.success(res, { url: null })
    }

    const url = `https://form.typeform.com/to/${formActivo.id}`

    // Persistir en ConfigApp para no volver a consultar la API
    await Promise.all([
      prisma.configApp.upsert({
        where: { clave: 'typeform_form_id' },
        update: { valor: formActivo.id },
        create: { clave: 'typeform_form_id', valor: formActivo.id },
      }),
      prisma.configApp.upsert({
        where: { clave: 'typeform_form_url' },
        update: { valor: url },
        create: { clave: 'typeform_form_url', valor: url },
      }),
    ])

    logger.info(`Formulario Typeform auto-sincronizado: ${formActivo.id} (${formActivo.title})`)
    return ApiResponse.success(res, { url })
  } catch (err) {
    logger.error({ err }, 'Error al auto-sincronizar formulario Typeform')
    return ApiResponse.success(res, { url: null })
  }
}))

// ── Activar webhook en el formulario activo (solo ADMIN) ─────────────────────
router.post('/webhook/activar', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const cfg = await prisma.configApp.findUnique({ where: { clave: 'typeform_form_id' } })

  if (!cfg?.valor) {
    return res.status(400).json({ error: 'No hay formulario activo. Crea uno primero.' })
  }

  const result = await configurarWebhook(cfg.valor)

  if (!result.ok) {
    return res.status(500).json({ error: result.mensaje })
  }

  return ApiResponse.success(res, {
    formId:  cfg.valor,
    mensaje: result.mensaje,
  })
}))

// ── Eliminar formulario activo (reset, solo ADMIN) ────────────────────────────
router.delete('/formulario-activo', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  await prisma.configApp.deleteMany({
    where: { clave: { in: ['typeform_form_id', 'typeform_form_url'] } },
  })
  return ApiResponse.success(res, { message: 'Formulario activo eliminado. Ya puedes generar uno nuevo.' })
}))

// ── Listar formularios ───────────────────────────────────────────────────────
router.get('/formularios', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const response = await fetch(`${TYPEFORM_API}/forms`, {
    headers: typeformHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    return res.status(500).json({ error: 'Error al listar formularios', details: error })
  }

  const data = await response.json()
  return ApiResponse.success(res, data)
}))

// ── Webhook — recibir respuestas de Typeform ─────────────────────────────────
router.post('/webhook', asyncHandler(async (req, res) => {
  const payload = req.body

  if (!payload?.form_response) {
    return res.status(400).json({ error: 'Payload inválido' })
  }

  const answers = payload.form_response.answers as any[]

  // Helper: obtener respuesta por ref del campo
  const get = (ref: string): any => {
    const answer = answers?.find((a: any) => a.field?.ref === ref)
    if (!answer) return null
    switch (answer.type) {
      case 'text':         return answer.text
      case 'email':        return answer.email
      case 'phone_number': return answer.phone_number
      case 'number':       return answer.number
      case 'boolean':      return answer.boolean
      case 'date':         return answer.date
      case 'file_url':     return answer.file_url        // comprobante
      case 'choice':       return answer.choice?.label ?? answer.choice?.other
      case 'choices':      return answer.choices?.labels?.join(', ')
      default:             return null
    }
  }

  // Calcular edad desde fecha de nacimiento (no se pregunta en el formulario)
  function calcularEdad(fechaNac: Date): number {
    const hoy = new Date()
    let edad = hoy.getFullYear() - fechaNac.getFullYear()
    const m = hoy.getMonth() - fechaNac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) edad--
    return edad
  }

  try {
    // ── 1. Buscar o crear colegio ──────────────────────────────────────────
    const nombreColegio = get('colegio') as string | null
    let colegioId: string | undefined

    if (nombreColegio) {
      const ciudadRaw = (get('ciudad_residencia') as string) ?? ''
      const ciudad = ciudadRaw.split(',')[0].trim()

      let colegio = await prisma.colegio.findFirst({
        where: { nombre: { equals: nombreColegio, mode: 'insensitive' } },
      })
      if (!colegio) {
        colegio = await prisma.colegio.create({
          data: { nombre: nombreColegio, ciudad },
        })
      }
      colegioId = colegio.id
    }

    // ── 2. Verificar si el estudiante ya existe ────────────────────────────
    const email = get('email_google') as string
    const existente = await prisma.estudiante.findFirst({ where: { email } })

    if (existente) {
      // Si ya existe, registrar el pago SOLO si no fue procesado antes (idempotencia por token)
      logger.info(`Estudiante ya registrado (${existente.id}), verificando idempotencia`)

      const responseToken = payload.form_response.token as string | null

      function parseMonto2(raw: unknown): number {
        if (!raw) return 0
        const limpio = String(raw).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
        const n = parseFloat(limpio)
        return isNaN(n) ? 0 : Math.round(n)
      }

      const montoExistente = parseMonto2(get('monto_consignado'))

      // Verificar si este response ya fue procesado (buscar token en notas del pago)
      const yaProcessado = responseToken
        ? await prisma.pago.findFirst({
            where: { estudianteId: existente.id, notas: { contains: responseToken } },
          })
        : null

      if (yaProcessado) {
        logger.info(`Response ${responseToken} ya fue procesado para ${existente.id}, omitiendo`)
        return res.status(200).json({
          message:      'Estudiante ya registrado — respuesta ya procesada (duplicado omitido)',
          estudianteId: existente.id,
          pagoRegistrado: false,
        })
      }

      if (montoExistente > 0) {
        const comprobanteRawEx = get('comprobante_pago') as string | null
        const esUrlEx          = !!comprobanteRawEx && /^https?:\/\//i.test(comprobanteRawEx.trim())
        const comprobanteExistente = esUrlEx ? comprobanteRawEx!.trim() : null
        const cuentaExistente  = get('cuenta_pago') as string | null
        const cursoLabelEx     = get('curso_seleccionado') as string | null

        await prisma.pago.create({
          data: {
            estudianteId:    existente.id,
            monto:           montoExistente,
            estado:          'PENDIENTE',
            fechaVencimiento: new Date(),
            fechaPago:       comprobanteExistente ? new Date(payload.form_response.submitted_at ?? Date.now()) : null,
            metodo:          'Bancolombia',
            comprobante:     comprobanteExistente,
            notas: [
              'Pago adicional vía Typeform (estudiante ya registrado).',
              responseToken ? `ResponseID: ${responseToken}.` : '',
              cuentaExistente  ? `Cuenta: ${cuentaExistente}.` : '',
              cursoLabelEx     ? `Curso: ${cursoLabelEx}.` : '',
            ].filter(Boolean).join(' '),
          },
        })
        logger.info(`Pago adicional registrado para estudiante existente ${existente.id}: $${montoExistente}`)
      }

      return res.status(200).json({
        message:      'Estudiante ya registrado — pago adicional procesado',
        estudianteId: existente.id,
        pagoRegistrado: montoExistente > 0,
      })
    }

    // ── 3. Calcular edad automáticamente ──────────────────────────────────
    const fechaNacRaw = get('fecha_nacimiento') as string | null
    const fechaNacimiento = fechaNacRaw ? new Date(fechaNacRaw) : new Date('2000-01-01')
    const edad = calcularEdad(fechaNacimiento)

    // ── 4. Buscar curso seleccionado ───────────────────────────────────────
    const cursoLabel = get('curso_seleccionado') as string | null
    let cursoId: string | undefined
    let cursoPrecio = 0

    if (cursoLabel) {
      // El label tiene formato: "Nombre del curso - $XXX.XXX"
      // Buscar por nombre (parte antes del " - $")
      const nombreCurso = cursoLabel.split(' - ')[0].trim()
      const curso = await prisma.curso.findFirst({
        where: { nombre: { equals: nombreCurso, mode: 'insensitive' }, activo: true },
      })
      if (curso) {
        cursoId = curso.id
        cursoPrecio = curso.precio
      }
    }

    // ── 5. Crear estudiante ────────────────────────────────────────────────
    const estudiante = await prisma.estudiante.create({
      data: {
        nombre:             get('nombres_apellidos') as string,
        email,
        telefono:           get('celular_estudiante') as string ?? '',
        fechaNacimiento,
        tipoDocumento:      get('tipo_documento_estudiante') as string ?? 'TI',
        documento:          get('numero_documento_estudiante') as string ?? '',
        grado:              get('grado') as string ?? '',
        ciudad:             get('ciudad_residencia') as string ?? '',
        primerIcfes:        get('primer_icfes') as boolean ?? true,
        puntajeAnterior:    get('puntaje_anterior') as string ?? 'N/A',
        carreraInteres:     get('carrera_interes') as string ?? '',
        interesPremedico:   get('interes_premedico') as string ?? '',
        universidadInteres: get('universidad_interes') as string ?? '',
        colegioId,
        acudiente: {
          create: {
            nombre:          get('nombres_acudiente') as string ?? '',
            telefono:        get('celular_acudiente') as string ?? '',
            relacion:        get('parentesco_acudiente') as string ?? 'Otro',
            tipoDocumento:   get('tipo_documento_acudiente') as string ?? '',
            numeroDocumento: get('numero_documento_acudiente') as string ?? '',
          },
        },
      },
      include: { acudiente: true },
    })

    logger.info(`Estudiante creado vía Typeform: ${estudiante.id} — ${estudiante.nombre} (edad calculada: ${edad})`)

    // Helper: parsear monto en formato colombiano "600.000" → 600000
    function parseMonto(raw: unknown): number {
      if (!raw) return 0
      const limpio = String(raw).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
      const n = parseFloat(limpio)
      return isNaN(n) ? 0 : Math.round(n)
    }

    const montoConsignado = parseMonto(get('monto_consignado'))

    // ── 6. Asignar curso (CursoEstudiante) ────────────────────────────────
    if (cursoId) {
      // Descuento siempre en 0 al inscribirse — el admin lo ajusta manualmente si aplica
      await prisma.cursoEstudiante.create({
        data: { estudianteId: estudiante.id, cursoId, descuentoPorcentaje: 0 },
      })
      logger.info(`CursoEstudiante creado: estudianteId=${estudiante.id} cursoId=${cursoId}`)
    }

    // ── 7. Registrar fuente de marketing ──────────────────────────────────
    const fuenteContacto = get('como_conocio') as string | null
    if (fuenteContacto) {
      await prisma.fuenteContacto.create({
        data: {
          estudianteId: estudiante.id,
          fuente:       fuenteContacto,
          formId:       payload.form_response.form_id ?? '',
          respondedAt:  new Date(payload.form_response.submitted_at ?? Date.now()),
        },
      })
    }

    // ── 8. Registrar pago con comprobante ─────────────────────────────────
    const comprobanteRaw   = get('comprobante_pago') as string | null
    const cuentaPago       = get('cuenta_pago') as string | null
    const responseToken    = payload.form_response.token as string | null

    // Solo guardar como URL si realmente parece un enlace; de lo contrario va a notas
    const esUrl = (s: string | null) => !!s && /^https?:\/\//i.test(s.trim())
    const comprobanteUrl = esUrl(comprobanteRaw) ? comprobanteRaw!.trim() : null

    if (montoConsignado > 0) {
      await prisma.pago.create({
        data: {
          estudianteId:    estudiante.id,
          monto:           montoConsignado,
          estado:          'PENDIENTE',  // siempre pendiente de verificación humana
          fechaVencimiento: new Date(),
          fechaPago:       comprobanteUrl ? new Date(payload.form_response.submitted_at ?? Date.now()) : null,
          metodo:          'Bancolombia',
          comprobante:     comprobanteUrl,  // null si el estudiante no pegó un link real
          notas: [
            `Inscripción vía Typeform.`,
            responseToken ? `ResponseID: ${responseToken}.` : '',
            cuentaPago ? `Cuenta: ${cuentaPago}.` : '',
            cursoLabel ? `Curso: ${cursoLabel}.` : '',
          ].filter(Boolean).join(' '),
        },
      })
      logger.info(`Pago registrado: $${montoConsignado} ${comprobanteUrl ? '(con comprobante)' : '(sin comprobante)'}`)
    }

    // Notificar en tiempo real a todos los clientes SSE conectados
    broadcast('nuevo-estudiante', {
      id:     estudiante.id,
      nombre: estudiante.nombre,
      email:  estudiante.email,
    })

    logger.info(`Estudiante inscrito vía Typeform: ${estudiante.id} — ${estudiante.nombre}`)
    return res.status(200).json({
      message:      'Inscripción procesada correctamente',
      estudianteId: estudiante.id,
      edad,
      cursoAsignado: !!cursoId,
      comprobante:   !!comprobanteUrl,
    })

  } catch (error: any) {
    logger.error({ err: error }, 'Error procesando webhook Typeform')
    return res.status(500).json({ error: 'Error procesando inscripción', details: error.message })
  }
}))

// ── Procesar respuestas existentes del formulario (solo ADMIN) ───────────────
router.post('/procesar-respuestas', authenticate, requireRole('ADMIN'), asyncHandler(async (_req, res) => {
  const cfg = await prisma.configApp.findUnique({ where: { clave: 'typeform_form_id' } })
  if (!cfg?.valor) {
    return res.status(400).json({ error: 'No hay formulario activo configurado.' })
  }

  const formId = cfg.valor
  const tfRes = await fetch(`${TYPEFORM_API}/forms/${formId}/responses?page_size=100`, {
    headers: typeformHeaders(),
  })
  if (!tfRes.ok) {
    return res.status(502).json({ error: 'No se pudieron obtener las respuestas de Typeform.' })
  }

  const data   = await tfRes.json() as { items: any[] }
  const items  = data.items ?? []

  let procesados = 0
  let omitidos   = 0
  const errores: string[] = []

  for (const item of items) {
    try {
      // Reenviar al propio webhook endpoint para reutilizar toda la lógica
      const r = await fetch(
        `https://api-production-79572.up.railway.app/api/typeform/webhook`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ form_response: item }),
        }
      )
      const json = await r.json() as any
      if (json?.message?.includes('ya registrado')) {
        omitidos++
      } else {
        procesados++
      }
    } catch (err: any) {
      errores.push(err.message ?? 'Error desconocido')
    }
  }

  return ApiResponse.success(res, {
    total: items.length,
    procesados,
    omitidos,
    errores: errores.slice(0, 10),
  })
}))

export default router
