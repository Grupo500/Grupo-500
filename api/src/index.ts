import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

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

const app = express()
const PORT = process.env.PORT || 3001

// Security headers
app.use(helmet())
app.disable('x-powered-by')

// CORS — solo orígenes permitidos
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))

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

// Rate limiting estricto en auth
app.use('/api/auth', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
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

// Error handler global (siempre al final)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`🚀 Servidor Grupo 500 corriendo en puerto ${PORT}`)
})

export default app
