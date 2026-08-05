import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { addClient, removeClient } from '../utils/sseManager'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { emitirTicket, consumirTicket } from '../utils/ticketsSSE'
import { logger } from '../utils/logger'

const router = Router()

/**
 * POST /api/eventos/ticket
 *
 * Canjea la sesión (que viaja en la cabecera Authorization, donde nadie la
 * registra) por un ticket de un solo uso y 30 segundos de vida. Ese ticket es lo
 * único que después va en la URL del SSE.
 */
router.post('/ticket', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { ticket, vidaMs } = emitirTicket({
    userId: req.userId!,
    role: req.userRole!,
    nombre: req.userName,
  })
  return ApiResponse.success(res, { ticket, vidaMs })
}))

/**
 * GET /api/eventos?ticket=xxx
 *
 * `EventSource` no admite cabeceras custom, así que la credencial tiene que ir
 * en la URL. Va un ticket de un solo uso en vez del JWT de sesión: si queda
 * registrado en algún intermediario que no controlamos, ya no sirve.
 */
router.get('/', async (req: Request, res: Response) => {
  const ticket = req.query.ticket as string | undefined
  const tokenLegado = req.query.token as string | undefined

  let identidad: { userId: string; role: string } | null = null

  if (ticket) {
    const datos = consumirTicket(ticket)
    if (!datos) {
      // Un ticket gastado o vencido no es necesariamente un ataque: es lo que
      // pasa cuando EventSource reintenta solo con la misma URL.
      res.status(401).json({ error: 'Ticket inválido, vencido o ya usado' })
      return
    }
    identidad = { userId: datos.userId, role: datos.role }
  } else if (tokenLegado) {
    // TRANSICIÓN: pestañas con el bundle viejo siguen mandando el JWT. Se acepta
    // para no dejarlas sin eventos en vivo hasta que recarguen. Cuando este
    // aviso deje de aparecer en los logs, se puede borrar esta rama.
    try {
      const payload = jwt.verify(tokenLegado, process.env.NEXTAUTH_SECRET!) as { sub?: string; role?: string }
      identidad = { userId: payload.sub ?? 'desconocido', role: payload.role ?? 'desconocido' }
      logger.warn(
        { type: 'sse_token_legado', userId: identidad.userId },
        'conexión SSE con el JWT en la URL: bundle viejo, todavía sin recargar',
      )
    } catch {
      res.status(401).json({ error: 'Token inválido' })
      return
    }
  } else {
    res.status(401).json({ error: 'Ticket requerido' })
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
  logger.info(
    { type: 'sse_conectado', userId: identidad.userId, via: ticket ? 'ticket' : 'token_legado' },
    'cliente SSE conectado',
  )

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
