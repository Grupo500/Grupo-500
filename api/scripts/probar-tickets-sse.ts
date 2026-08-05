// Ciclo de vida del ticket de SSE: un solo uso, caducidad y aislamiento.
// Uso: npx tsx scripts/probar-tickets-sse.ts

import { emitirTicket, consumirTicket, ticketsPendientes, VIDA_TICKET_MS } from '../src/utils/ticketsSSE'

let fallos = 0
const comprobar = (etiqueta: string, condicion: boolean) => {
  console.log(`${condicion ? 'OK  ' : '### '} ${etiqueta}`)
  if (!condicion) fallos++
}

const datos = { userId: 'usr_1', role: 'ADMIN' as never, nombre: 'David' }

// 1. Se emite y se puede usar una vez
const { ticket, vidaMs } = emitirTicket(datos)
comprobar('el ticket es opaco y suficientemente largo', ticket.length >= 40 && !/[^\w-]/.test(ticket))
comprobar('no contiene el userId', !ticket.includes('usr_1'))
comprobar('informa su vida útil', vidaMs === VIDA_TICKET_MS)

const primero = consumirTicket(ticket)
comprobar('el primer uso devuelve la identidad', primero?.userId === 'usr_1' && primero?.role === 'ADMIN')

// 2. El segundo uso falla — esto es el punto de todo el cambio
comprobar('el SEGUNDO uso falla', consumirTicket(ticket) === null)
comprobar('un tercer intento también', consumirTicket(ticket) === null)

// 3. Basura y vacíos
comprobar('un ticket inventado falla', consumirTicket('inventado') === null)
comprobar('undefined falla', consumirTicket(undefined) === null)
comprobar('cadena vacía falla', consumirTicket('') === null)

// 4. Dos tickets del mismo usuario son independientes
const a = emitirTicket(datos).ticket
const b = emitirTicket(datos).ticket
comprobar('dos emisiones dan tickets distintos', a !== b)
comprobar('gastar uno no invalida el otro', consumirTicket(a) !== null && consumirTicket(b) !== null)

// 5. Caducidad: se simula moviendo el reloj
const viejo = emitirTicket(datos).ticket
const ahoraReal = Date.now
Date.now = () => ahoraReal() + VIDA_TICKET_MS + 1_000
try {
  comprobar('un ticket vencido falla', consumirTicket(viejo) === null)
} finally {
  Date.now = ahoraReal
}

// 6. El mapa no se queda con basura
const antes = ticketsPendientes()
const sobrantes = Array.from({ length: 20 }, () => emitirTicket(datos).ticket)
sobrantes.forEach(t => consumirTicket(t))
comprobar(`el mapa vuelve a su tamaño (antes ${antes}, ahora ${ticketsPendientes()})`, ticketsPendientes() <= antes)

// 7. El purgado limpia los vencidos aunque nadie los use
emitirTicket(datos)
const conUnoVivo = ticketsPendientes()
Date.now = () => ahoraReal() + VIDA_TICKET_MS + 1_000
try {
  consumirTicket('dispara-el-purgado')
  comprobar(`el purgado bota los vencidos (había ${conUnoVivo}, quedan ${ticketsPendientes()})`, ticketsPendientes() === 0)
} finally {
  Date.now = ahoraReal
}

console.log(fallos ? `\n${fallos} fallos` : '\nCiclo de vida del ticket correcto')
process.exit(fallos ? 1 : 0)
