// ============================================================
// Sincronización de leads desde HubSpot.
//
// Los leads NO son los "Contactos" de HubSpot (esos son muy pocos,
// solo la gente que llega a completar un formulario). El grueso de
// los leads llega como conversaciones (chat/email/formulario) que
// HubSpot autoasigna a un asesor y registra como "Ticket". Cada
// Ticket con owner asignado = 1 lead, exactamente igual que
// TrengoTicket. Cruzamos por el email del owner (ver ranking.ts).
// ============================================================
import { prisma } from '../config/prisma'
import { emailKey } from './ranking'

const HS_API = 'https://api.hubapi.com'

function headers() {
  const key = process.env.HUBSPOT_API_KEY
  if (!key) throw new Error('HUBSPOT_API_KEY no configurado')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

interface HubspotOwner { id: string; email?: string }
interface HubspotTicket { id: string; properties: { hubspot_owner_id?: string; createdate?: string } }

// Trae todos los owners de HubSpot (id → email canónico)
async function obtenerOwners(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  let after: string | undefined

  do {
    const url = new URL(`${HS_API}/crm/v3/owners`)
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)

    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(`HubSpot owners error: ${res.status} ${await res.text()}`)

    const body = await res.json() as { results: HubspotOwner[]; paging?: { next?: { after: string } } }
    for (const o of body.results) {
      if (o.email) mapa.set(o.id, emailKey(o.email))
    }
    after = body.paging?.next?.after
  } while (after)

  return mapa
}

// Trae los tickets con owner asignado, creados desde `desde` (si se indica).
// Sin `desde` trae TODO el histórico (solo para la primera sincronización).
async function obtenerTickets(desde?: Date): Promise<HubspotTicket[]> {
  const tickets: HubspotTicket[] = []
  let after: string | undefined

  const filtros: { propertyName: string; operator: string; value?: string }[] = [
    { propertyName: 'hubspot_owner_id', operator: 'HAS_PROPERTY' },
  ]
  if (desde) filtros.push({ propertyName: 'createdate', operator: 'GTE', value: String(desde.getTime()) })

  do {
    const res = await fetch(`${HS_API}/crm/v3/objects/tickets/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        limit: 100,
        after,
        sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
        properties: ['hubspot_owner_id', 'createdate'],
        filterGroups: [{ filters: filtros }],
      }),
    })
    if (!res.ok) throw new Error(`HubSpot tickets error: ${res.status} ${await res.text()}`)

    const body = await res.json() as { results: HubspotTicket[]; paging?: { next?: { after: string } } }
    tickets.push(...body.results)
    after = body.paging?.next?.after
  } while (after)

  return tickets
}

export interface ResultadoSyncHubspot {
  ticketsVistos: number
  sincronizados: number
  sinOwnerReconocido: number
}

export async function sincronizarLeadsHubspot(): Promise<ResultadoSyncHubspot> {
  // Sincronización incremental: solo traemos tickets nuevos desde el
  // último que ya tenemos guardado, para no repaginar el histórico completo
  // en cada sincronización (hoy son ~7.8k tickets y crece cada día).
  const ultimo = await prisma.hubspotLead.aggregate({ _max: { createdAtHubspot: true } })
  const desde = ultimo._max.createdAtHubspot ?? undefined

  const [owners, tickets] = await Promise.all([obtenerOwners(), obtenerTickets(desde)])

  let sincronizados = 0
  let sinOwnerReconocido = 0

  for (const t of tickets) {
    const ownerId = t.properties.hubspot_owner_id
    const email = ownerId ? owners.get(ownerId) : undefined
    if (!email) { sinOwnerReconocido++; continue }

    const createdAtHubspot = t.properties.createdate ? new Date(t.properties.createdate) : new Date()

    await prisma.hubspotLead.upsert({
      where: { ticketId: t.id },
      create: { ticketId: t.id, ownerEmail: email, createdAtHubspot },
      update: { ownerEmail: email, createdAtHubspot },
    })
    sincronizados++
  }

  return { ticketsVistos: tickets.length, sincronizados, sinOwnerReconocido }
}
