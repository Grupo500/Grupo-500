import './setTz'
import './instrument'
import * as Sentry from '@sentry/node'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { redactarUrl } from './utils/redactar'
import { validateEnv } from './utils/validateEnv'
import { prisma } from './config/prisma'

// Falla rápido si faltan variables críticas — antes de cualquier otra inicialización
validateEnv()

// Routes
import authRoutes from './routes/auth'
import estudiantesRoutes from './routes/estudiantes'
import asesoresRoutes from './routes/asesores'
import cursosRoutes from './routes/cursos'
import colegiosRoutes from './routes/colegios'
import pagosRoutes from './routes/pagos'
import certificadosRoutes from './routes/certificados'
import simulacrosRoutes from './routes/simulacros'
import reportesRoutes from './routes/reportes'
import finanzasRoutes from './routes/finanzas'
import webhookRoutes from './routes/webhooks'
import trengoRoutes from './routes/trengo'
import hubspotRoutes from './routes/hubspot'
import marketingRoutes from './routes/marketing'
import afiliacionesRoutes from './routes/afiliaciones'
import uploadRoutes from './routes/upload'
import configRoutes from './routes/config'
import negociacionesRoutes from './routes/negociaciones'
import eventosRoutes from './routes/eventos'
import passkeysRoutes from './routes/passkeys'
import inscripcionRoutes from './routes/inscripcion'
import formulariosRoutes from './routes/formularios'
import hotmartRoutes from './routes/hotmart'
import notificacionesRoutes from './routes/notificaciones'
import publicRoutes from './routes/public'
import apiKeysRoutes from './routes/apiKeys'
import { reconciliarAsesores } from './jobs/reconciliarAsesores'
import { backfillComisiones } from './jobs/backfillComisiones'
import { sincronizarGoogleAds } from './jobs/sincronizarGoogleAds'
import { backfillCuotas } from './jobs/backfillCuotas'
import { sincronizarAtrasos } from './jobs/sincronizarAtrasos'
import redesRoutes from './routes/redes'
import { publicarRedesPendientes } from './jobs/publicarRedes'
import { respaldarBaseDatos, backupVencido, horaColombia } from './jobs/backupBaseDatos'

const app = express()

const PORT = process.env.PORT || 3001
// Deploy de prueba (aislar si un deploy normal afecta la auth) — sin cambios funcionales

// Railway y proxies inversos envían X-Forwarded-For — necesario para rate-limit y HTTPS
app.set('trust proxy', 1)

// Correlation ID — agrega reqId único a cada request para trazabilidad en logs
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { reqId: string }).reqId = crypto.randomUUID()
  next()
})

// Timeout por request — evita que queries lentas bloqueen workers indefinidamente
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Tiempo de espera agotado.' })
    }
  })
  next()
})

// Security headers — configuración explícita (no defaults)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'"],
      imgSrc:         ["'self'", 'data:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,  // Railway/Cloudinary requieren esto desactivado
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },
}))
app.disable('x-powered-by')

// CORS — valida origen dinámicamente contra ALLOWED_ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile, Postman, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS bloqueado para origen: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Responder preflight OPTIONS en todas las rutas
app.options('*', cors())

// ⚠️ Webhooks ANTES del JSON middleware — necesitan raw body para verificar firma
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)
app.use('/api/hotmart/webhook', express.raw({ type: 'application/json' }))

// Compresión y body parsing (para el resto de rutas)
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging HTTP con reqId para trazabilidad.
//
// La URL se redacta antes de escribirla: hay endpoints que reciben el token por
// query string porque no les queda otra (SSE no admite cabeceras, los webhooks
// de terceros solo dejan configurar una URL) y así el secreto no queda guardado.
morgan.token('urlSegura', (req: Request) => redactarUrl(req.originalUrl || req.url))
const FORMATO_COMBINED_SEGURO =
  ':remote-addr - :remote-user [:date[clf]] ":method :urlSegura HTTP/:http-version"'
  + ' :status :res[content-length] ":referrer" ":user-agent"'

app.use(morgan(FORMATO_COMBINED_SEGURO, {
  stream: {
    write: (msg) => {
      logger.info(msg.trim())
    }
  }
}))

// Loguear reqId en cada request entrante
app.use((req: Request & { reqId?: string }, _res: Response, next: NextFunction) => {
  logger.info({ reqId: req.reqId, method: req.method, url: redactarUrl(req.url) })
  next()
})

// Rate limiting global
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes, intenta más tarde.' }
}))

// Rate limiting por usuario autenticado (post-auth routes)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.headers.authorization?.slice(-20) || req.ip || 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Límite por minuto alcanzado.' },
}))


// Health check profundo — valida DB antes de retornar 200
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() })
  }
})

// Rutas
app.use('/api/auth',      authRoutes)
app.use('/api/estudiantes', estudiantesRoutes)
app.use('/api/asesores', asesoresRoutes)
app.use('/api/cursos', cursosRoutes)
app.use('/api/colegios', colegiosRoutes)
app.use('/api/pagos', pagosRoutes)
app.use('/api/certificados', certificadosRoutes)
app.use('/api/simulacros', simulacrosRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/finanzas', finanzasRoutes)
app.use('/api/upload',  uploadRoutes)
app.use('/api/config',       configRoutes)
app.use('/api/negociaciones', negociacionesRoutes)
app.use('/api/inscripcion',   inscripcionRoutes)
app.use('/api/formularios',  formulariosRoutes)
app.use('/api/eventos',     eventosRoutes)
app.use('/api/passkeys',    passkeysRoutes)
app.use('/api/hotmart',     hotmartRoutes)
app.use('/api/notificaciones', notificacionesRoutes)
app.use('/api/trengo',       trengoRoutes)
app.use('/api/hubspot',      hubspotRoutes)
app.use('/api/marketing',    marketingRoutes)
app.use('/api/redes',        redesRoutes)
app.use('/api/afiliaciones', afiliacionesRoutes)
app.use('/api/apikeys',      apiKeysRoutes)
app.use('/api/public/v1',    publicRoutes)

// Sentry error handler — debe ir ANTES del errorHandler custom y DESPUÉS de todas las rutas
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// Error handler global (siempre al final)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`🚀 Servidor Grupo 500 corriendo en puerto ${PORT}`)

  // Reconciliación automática de asesores: una corrida inicial a los 2 min
  // y luego cada 15 min. Red de seguridad si el webhook no captura el afiliado.
  const QUINCE_MIN = 15 * 60 * 1000
  setTimeout(() => { void reconciliarAsesores() }, 2 * 60 * 1000)
  setInterval(() => { void reconciliarAsesores() }, QUINCE_MIN)

  // Desglose de comisiones: completa los pagos que falten. Corrida inicial a
  // los 3 min y luego cada 15 min (el webhook ya lo calcula al instante; esto
  // es la red de seguridad por si la comisión no estaba lista en Hotmart aún).
  setTimeout(() => { void backfillComisiones() }, 3 * 60 * 1000)
  setInterval(() => { void backfillComisiones() }, QUINCE_MIN)

  // Inversión publicitaria de Google Ads. Cada 4 horas basta: el gasto del día
  // en curso es una estimación que Google sigue ajustando, y consultar más
  // seguido solo quemaría cuota sin traer cifras más firmes.
  const CUATRO_HORAS = 4 * 60 * 60 * 1000
  setTimeout(() => { void sincronizarGoogleAds() }, 4 * 60 * 1000)
  setInterval(() => { void sincronizarGoogleAds() }, CUATRO_HORAS)

  // Cuotas de Hotmart (Smart Installment): el webhook solo avisa la primera,
  // las siguientes no reenvían notificación — sin esto, cuotaNumero se queda
  // congelado en 1 para siempre y el saldo pendiente queda inflado. Se
  // reconsulta la API de Hotmart sobre los últimos 120 días nada más, no todo
  // el historial, para no repetir trabajo ya resuelto en cada corrida.
  const ventanaCuotas = () => new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  setTimeout(() => { void backfillCuotas(true, ventanaCuotas()) }, 5 * 60 * 1000)
  setInterval(() => { void backfillCuotas(true, ventanaCuotas()) }, CUATRO_HORAS)

  // Cuotas atrasadas: Hotmart sabe qué cobro rebotó y hasta lo reintenta solo.
  // Corre después del backfill de arriba para que un abono recién registrado ya
  // esté marcado como cuota y no se avise de algo que el cliente ya pagó.
  setTimeout(() => { void sincronizarAtrasos(true, ventanaCuotas()) }, 8 * 60 * 1000)
  setInterval(() => { void sincronizarAtrasos(true, ventanaCuotas()) }, CUATRO_HORAS)

  // Publicador de redes sociales (Marketing > Redes): cada minuto revisa las
  // publicaciones programadas vencidas y las sube a IG/FB vía la Graph API.
  setInterval(() => { void publicarRedesPendientes() }, 60 * 1000)

  // Respaldo nocturno de la base a Drive, a las 23:59 de Colombia. Se revisa
  // el reloj cada minuto en vez de calcular un setTimeout largo: sobrevive a
  // reinicios del contenedor sin re-derivar nada. El candado del día evita
  // repetirlo si el minuto 23:59 alcanza a verse dos veces.
  let ultimoBackupDia = ''
  setInterval(() => {
    if (horaColombia() !== '23:59') return
    const dia = new Date().toISOString().slice(0, 10)
    if (dia === ultimoBackupDia) return
    ultimoBackupDia = dia
    void respaldarBaseDatos()
  }, 60 * 1000)

  // Y al arrancar: si el último respaldo tiene más de 26 horas —el contenedor
  // estuvo caído a las 23:59, o el job murió— se hace uno de inmediato. Es
  // también lo que permite verificar el sistema el día que se despliega.
  setTimeout(() => {
    void backupVencido(26).then(vencido => { if (vencido) void respaldarBaseDatos() })
  }, 3 * 60 * 1000)
})

export default app

// Redeploy 2026-08-18: el build de las 21:33 fallo al publicar la imagen.
