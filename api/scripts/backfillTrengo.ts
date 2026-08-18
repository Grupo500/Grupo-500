// ============================================================
// Rellena TrengoTicket con el HISTORIAL completo de la API de
// Trengo. El webhook solo registra tickets desde que se instaló
// (18-ago-2026); sin este backfill, la tasa de cierre de meses
// anteriores no tiene leads de Trengo contra los cuales comparar.
//
// Uso (el token NO se guarda en el repo ni en la base):
//   TRENGO_API_TOKEN=xxx DATABASE_URL=... npx tsx scripts/backfillTrengo.ts
//
// Es idempotente: upsert por ticketId, se puede correr las veces
// que haga falta.
// ============================================================
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API = 'https://app.trengo.com/api/v2'
const token = process.env.TRENGO_API_TOKEN

async function trengo(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) {
    // Trengo limita por minuto: esperar y reintentar el mismo path
    await new Promise(r => setTimeout(r, 30_000))
    return trengo(path)
  }
  if (!res.ok) throw new Error(`Trengo ${res.status} en ${path}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function main() {
  if (!token) throw new Error('Falta TRENGO_API_TOKEN')

  // 1. Mapa de agentes: user_id → email
  const usuarios = await trengo('/users')
  const emailPorUsuario = new Map<number, string>()
  for (const u of usuarios.data ?? usuarios) {
    if (u.id && u.email) emailPorUsuario.set(u.id, String(u.email).toLowerCase().trim())
  }
  console.log(`Agentes en Trengo: ${emailPorUsuario.size}`)

  // 2. Tickets paginados (todos los estados, historial completo)
  let pagina = 1
  let importados = 0
  let sinAgente = 0
  for (;;) {
    const lote = await trengo(`/tickets?page=${pagina}`)
    const tickets: any[] = lote.data ?? []
    if (tickets.length === 0) break

    for (const t of tickets) {
      // El agente puede venir como objeto (agent/user) o como id suelto,
      // según el estado del ticket — se aceptan todas las formas.
      const agenteId: number | undefined =
        t.agent?.id ?? t.user?.id ?? t.assigned_user_id ?? t.user_id ?? undefined
      const email = agenteId ? emailPorUsuario.get(agenteId) : (t.agent?.email ?? t.user?.email)
      if (!email) { sinAgente++; continue }

      // Fecha de asignación: Trengo la expone como assigned_at; si no viene,
      // la fecha de creación del ticket es la mejor aproximación disponible.
      const fecha = t.assigned_at ?? t.created_at ?? t.updated_at
      if (!fecha) { sinAgente++; continue }

      await prisma.trengoTicket.upsert({
        where: { ticketId: String(t.id) },
        create: {
          ticketId: String(t.id),
          agentEmail: String(email).toLowerCase().trim(),
          firstAssignedAt: new Date(fecha),
        },
        // No pisar firstAssignedAt si el webhook ya lo registró: el webhook
        // vio la asignación en vivo y es más preciso que el histórico.
        update: {},
      })
      importados++
    }
    console.log(`página ${pagina}: acumulado ${importados} tickets con agente, ${sinAgente} sin agente`)
    if (!lote.links?.next && !lote.meta?.next_page_url && tickets.length < (lote.meta?.per_page ?? 25)) break
    pagina++
  }

  const porMes = await prisma.$queryRawUnsafe<any[]>(
    `select to_char("firstAssignedAt",'YYYY-MM') mes, count(*)::int n from "TrengoTicket" group by 1 order by 1`,
  )
  console.log('TrengoTicket por mes tras el backfill:', JSON.stringify(porMes))
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e.message); process.exit(1) })
