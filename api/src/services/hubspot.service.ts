// ============================================================
// Sincronización de leads desde HubSpot.
// Trae los contactos con "owner" asignado (equivalente al asesor)
// y los guarda en HubspotLead, cruzando por el email del owner —
// el mismo mecanismo que ya usamos con Trengo (ver ranking.ts).
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
interface HubspotContact { id: string; properties: { hubspot_owner_id?: string; createdate?: string } }

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

// Trae todos los contactos que tienen un owner asignado
async function obtenerContactos(): Promise<HubspotContact[]> {
  const contactos: HubspotContact[] = []
  let after: string | undefined

  do {
    const res = await fetch(`${HS_API}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        limit: 100,
        after,
        sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
        properties: ['hubspot_owner_id', 'createdate'],
        filterGroups: [{ filters: [{ propertyName: 'hubspot_owner_id', operator: 'HAS_PROPERTY' }] }],
      }),
    })
    if (!res.ok) throw new Error(`HubSpot contacts error: ${res.status} ${await res.text()}`)

    const body = await res.json() as { results: HubspotContact[]; paging?: { next?: { after: string } } }
    contactos.push(...body.results)
    after = body.paging?.next?.after
  } while (after)

  return contactos
}

export interface ResultadoSyncHubspot {
  contactosVistos: number
  sincronizados: number
  sinOwnerReconocido: number
}

export async function sincronizarLeadsHubspot(): Promise<ResultadoSyncHubspot> {
  const [owners, contactos] = await Promise.all([obtenerOwners(), obtenerContactos()])

  let sincronizados = 0
  let sinOwnerReconocido = 0

  for (const c of contactos) {
    const ownerId = c.properties.hubspot_owner_id
    const email = ownerId ? owners.get(ownerId) : undefined
    if (!email) { sinOwnerReconocido++; continue }

    const createdAtHubspot = c.properties.createdate ? new Date(c.properties.createdate) : new Date()

    await prisma.hubspotLead.upsert({
      where: { contactId: c.id },
      create: { contactId: c.id, ownerEmail: email, createdAtHubspot },
      update: { ownerEmail: email, createdAtHubspot },
    })
    sincronizados++
  }

  return { contactosVistos: contactos.length, sincronizados, sinOwnerReconocido }
}
