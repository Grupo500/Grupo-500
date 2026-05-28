import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { validateEnv } from './utils/validateEnv'

// Falla rápido si faltan variables críticas — antes de cualquier otra inicialización
validateEnv()

// Routes
import authRoutes from './routes/auth'
import estudiantesRoutes from './routes/estudiantes'
import asesoresRoutes from './routes/asesores'
import cursosRoutes from './routes/cursos'
import colegiosRoutes from './routes/colegios'
import pagosRoutes from './routes/pagos'
import financiamientosRoutes from './routes/financiamientos'
import cuotasRoutes from './routes/cuotas'
import cobrosRoutes from './routes/cobros'
import certificadosRoutes from './routes/certificados'
import simulacrosRoutes from './routes/simulacros'
import whatsappRoutes from './routes/whatsapp'
import reportesRoutes from './routes/reportes'
import webhookRoutes from './routes/webhooks'
import uploadRoutes from './routes/upload'
import configRoutes from './routes/config'
import negociacionesRoutes from './routes/negociaciones'
import hubspotRoutes  from './routes/hubspot'
import eventosRoutes from './routes/eventos'
import passkeysRoutes from './routes/passkeys'

const app = express()

const PORT = process.env.PORT || 3001

// Railway y proxies inversos envían X-Forwarded-For — necesario para rate-limit y HTTPS
app.set('trust proxy', 1)

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

// ⚠️ Webhooks de Clerk ANTES del JSON middleware — necesita raw body para verificar firma
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)

// Compresión y body parsing (para el resto de rutas)
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging HTTP
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}))

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

// Rate limiting estricto en auth — contar TODOS los intentos (exitosos y fallidos)
app.use('/api/auth', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  message: { success: false, error: 'Demasiados intentos de autenticación.' }
}))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rutas
app.use('/api/auth',      authRoutes)
app.use('/api/estudiantes', estudiantesRoutes)
app.use('/api/asesores', asesoresRoutes)
app.use('/api/cursos', cursosRoutes)
app.use('/api/colegios', colegiosRoutes)
app.use('/api/pagos', pagosRoutes)
app.use('/api/financiamientos', financiamientosRoutes)
app.use('/api/cuotas', cuotasRoutes)
app.use('/api/cobros', cobrosRoutes)
app.use('/api/certificados', certificadosRoutes)
app.use('/api/simulacros', simulacrosRoutes)
app.use('/api/whatsapp', whatsappRoutes)
app.use('/api/reportes', reportesRoutes)
app.use('/api/upload',  uploadRoutes)
app.use('/api/config',       configRoutes)
app.use('/api/negociaciones', negociacionesRoutes)
app.use('/api/hubspot',      hubspotRoutes)
app.use('/api/eventos',     eventosRoutes)
app.use('/api/passkeys',    passkeysRoutes)

// Error handler global (siempre al final)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`🚀 Servidor Grupo 500 corriendo en puerto ${PORT}`)
})

export default app
