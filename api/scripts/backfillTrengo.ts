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
    // Trengo limita por minuto: espera corta y reintento del mismo path.
    // (30s era demasiado conservador — alargaba el backfill por horas.)
    await new Promise(r => setTimeout(r, 5_000))
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

  // 2. Tickets paginados (todos los estados, historial completo).
  // TRENGO_DESDE_PAGINA permite reanudar una corrida interrumpida sin
  // repetir páginas ya guardadas (el upsert las haría inofensivas, pero
  // re-pedirlas gasta el límite de velocidad de la API, que es el cuello).
  let pagina = Math.max(1, parseInt(process.env.TRENGO_DESDE_PAGINA ?? '1', 10) || 1)
  let importados = 0
  let sinAgente = 0
  // Corte por antigüedad: las tasas de cierre solo usan leads desde junio-2026
  // (antes de eso no hay pagos contra los cuales comparar en la app). El orden
  // de Trengo no es estrictamente cronológico, así que no basta una página
  // vieja: se corta tras 20 páginas SEGUIDAS completamente anteriores al corte.
  const CORTE = new Date('2026-06-01T00:00:00-05:00').getTime()
  let paginasViejasSeguidas = 0
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
    const fechas = tickets.map(t => t.assigned_at ?? t.created_at).filter(Boolean).sort()
    console.log(`página ${pagina}: acumulado ${importados} con agente, ${sinAgente} sin agente | fechas ${String(fechas[0]).slice(0, 10)} → ${String(fechas[fechas.length - 1]).slice(0, 10)}`)

    const masReciente = fechas.length ? new Date(fechas[fechas.length - 1]).getTime() : 0
    paginasViejasSeguidas = masReciente && masReciente < CORTE ? paginasViejasSeguidas + 1 : 0
    if (paginasViejasSeguidas >= 20) {
      console.log(`CORTE: 20 páginas seguidas anteriores a jun-2026 — el resto del historial no afecta ninguna tasa.`)
      break
    }
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
