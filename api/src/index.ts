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
import webhookRoutes from './routes/webhooks'
import uploadRoutes from './routes/upload'
import configRoutes from './routes/config'
import negociacionesRoutes from './routes/negociaciones'
import eventosRoutes from './routes/eventos'
import passkeysRoutes from './routes/passkeys'
import inscripcionRoutes from './routes/inscripcion'
import formulariosRoutes from './routes/formularios'
import hotmartRoutes from './routes/hotmart'
import notificacionesRoutes from './routes/notificaciones'
import { reconciliarAsesores } from './jobs/reconciliarAsesores'
import { backfillComisiones } from './jobs/backfillComisiones'

const app = express()

const PORT = process.env.PORT || 3001

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

// Logging HTTP con reqId para trazabilidad
app.use(morgan('combined', {
  stream: {
    write: (msg) => {
      logger.info(msg.trim())
    }
  }
}))

// Loguear reqId en cada request entrante
app.use((req: Request & { reqId?: string }, _res: Response, next: NextFunction) => {
  logger.info({ reqId: req.reqId, method: req.method, url: req.url })
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
app.use('/api/upload',  uploadRoutes)
app.use('/api/config',       configRoutes)
app.use('/api/negociaciones', negociacionesRoutes)
app.use('/api/inscripcion',   inscripcionRoutes)
app.use('/api/formularios',  formulariosRoutes)
app.use('/api/eventos',     eventosRoutes)
app.use('/api/passkeys',    passkeysRoutes)
app.use('/api/hotmart',     hotmartRoutes)
app.use('/api/notificaciones', notificacionesRoutes)

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
})

export default app
