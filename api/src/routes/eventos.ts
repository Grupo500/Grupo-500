import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { addClient, removeClient } from '../utils/sseManager'

const router = Router()

// GET /api/eventos?token=xxx
// SSE no soporta headers custom → token va como query param
router.get('/', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined

  if (!token) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  try {
    jwt.verify(token, process.env.NEXTAUTH_SECRET!)
  } catch {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  // Cabeceras SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Nginx/Railway: deshabilita buffering
  res.flushHeaders()

  // Desactivar timeout del socket para SSE (conexión larga por diseño)
  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  req.socket.setKeepAlive(true, 10_000)

  // Confirmación de conexión
  res.write('event: conectado\ndata: {}\n\n')

  addClient(res)

  // Ping cada 20s para mantener la conexión viva en Railway (timeout 300s)
  const ping = setInterval(() => {
    try { res.write(':ping\n\n') } catch { /* cliente desconectado */ }
  }, 20_000)

  req.on('close', () => {
    clearInterval(ping)
    removeClient(res)
  })
})

export default router
