// Tickets de un solo uso para abrir la conexión SSE.
//
// `EventSource` no admite cabeceras, así que la credencial tiene que ir en la
// URL. Antes iba el JWT de sesión, válido una hora: si quedaba registrado en
// algún intermediario que no controlamos, servía para robar la sesión.
//
// Con esto lo que viaja en la URL es un identificador opaco que vale para UNA
// conexión y caduca en 30 segundos. Aunque quede registrado, no sirve para nada.
//
// El almacén es en memoria, igual que `sseManager`, que ya guarda las conexiones
// abiertas en un Set. Ambos comparten el mismo supuesto: una sola instancia del
// backend. Si algún día se escala a varias réplicas, el broadcast de SSE se
// rompe antes que esto, así que este archivo no es el que habría que cambiar
// primero.

import crypto from 'node:crypto'
import { Role } from '@prisma/client'

export const VIDA_TICKET_MS = 30_000

/** Techo defensivo: que un cliente en bucle no haga crecer el mapa sin fin. */
const MAX_TICKETS = 5_000

export interface DatosTicket {
  userId: string
  role: Role
  nombre?: string
}

interface Guardado extends DatosTicket {
  creado: number
}

const tickets = new Map<string, Guardado>()

function purgar() {
  const ahora = Date.now()
  for (const [id, t] of tickets) {
    if (ahora - t.creado > VIDA_TICKET_MS) tickets.delete(id)
  }
  // El Map conserva el orden de inserción: si aún sobra, caen los más viejos.
  while (tickets.size > MAX_TICKETS) {
    const primero = tickets.keys().next()
    if (primero.done) break
    tickets.delete(primero.value)
  }
}

export function emitirTicket(datos: DatosTicket): { ticket: string; vidaMs: number } {
  purgar()
  const ticket = crypto.randomBytes(32).toString('base64url')
  tickets.set(ticket, { ...datos, creado: Date.now() })
  return { ticket, vidaMs: VIDA_TICKET_MS }
}

/**
 * Valida y GASTA el ticket. Devuelve null si no existe, ya se usó o caducó.
 *
 * Se borra antes de comprobar la caducidad a propósito: un ticket presentado
 * tarde tampoco debe poder reintentarse.
 */
export function consumirTicket(ticket: string | undefined): DatosTicket | null {
  if (!ticket) return null
  purgar()
  const t = tickets.get(ticket)
  if (!t) return null
  tickets.delete(ticket)
  if (Date.now() - t.creado > VIDA_TICKET_MS) return null
  const { creado, ...datos } = t
  return datos
}

/** Solo para pruebas y diagnóstico. */
export const ticketsPendientes = () => tickets.size
