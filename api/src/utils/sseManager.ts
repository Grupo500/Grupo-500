import { Response } from 'express'

// Clientes SSE conectados (una entrada por tab/usuario abierto)
const clients = new Set<Response>()

export function addClient(res: Response) {
  clients.add(res)
}

export function removeClient(res: Response) {
  clients.delete(res)
}

export function broadcast(event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach(client => {
    try {
      client.write(payload)
    } catch {
      clients.delete(client)
    }
  })
}
