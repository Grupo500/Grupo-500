// ============================================================
// Lógica pura de ranking de asesores.
// Funciones sin acceso a BD; reciben datos ya consultados y
// devuelven el ranking calculado. Hora Colombia explícita.
// ============================================================

export const ZONA_HORARIA = 'America/Bogota'

export function diaColombia(d: Date | number | null): string | null {
  if (d === null) return null
  return new Date(d).toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}

export function hoyColombia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}

// Normaliza un email para usarlo como clave (lowercase + trim)
export function emailKey(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export type PagoAsesor = {
  asesorId: string | null
  monto: number
  estudianteId?: string
  comisionAsesor?: number | null
  fechaPago?: Date | null
}

export type AsesorInfo = {
  id: string
  nombre: string
  email: string
  image: string | null
}

export type FilaRanking = {
  id: string
  nombre: string
  image: string | null
  totalVentas: number
  cobrado: number
  cantidadPagos: number
  totalEstudiantes: number
  comisionGanada: number | null
  variacion: number
  ventasAnterior: number
  // Nuevos campos (Trengo + score)
  leads: number
  leadsHoy: number
  ventasHoy: number
  tasaCierre: number | null      // ventas histórico / leads histórico × 100
  tasaCierreHoy: number | null   // ventas hoy / leads hoy × 100
  score: number | null           // 0–100, 60% tasa cierre + 40% volumen
  esYo: boolean
}

// Score 0–100 combinando tasa de cierre (calidad) y volumen relativo (cantidad)
// - Si no hay leads → score basado solo en volumen relativo al máximo del período
// - Si hay leads → 60% tasa de cierre + 40% volumen relativo
export function calcularScore(
  tasaCierre: number | null,
  ventasAsesor: number,
  ventasMaximo: number,
): number | null {
  if (ventasMaximo <= 0) return null
  const volumenRel = (ventasAsesor / ventasMaximo) * 100 // 0–100
  if (tasaCierre === null) return Math.round(volumenRel)
  // Cap tasa de cierre a 100 para evitar scores > 100 si hay datos sucios
  const tc = Math.min(100, Math.max(0, tasaCierre))
  return Math.round(tc * 0.6 + volumenRel * 0.4)
}

// Construye el ranking completo a partir de los datos crudos.
// Mantiene compatibilidad con el shape anterior y agrega los campos nuevos.
export function construirRanking(args: {
  asesores: AsesorInfo[]
  pagosActual: PagoAsesor[]
  pagosAnterior: PagoAsesor[]
  // Conteos de leads desde Trengo (mapas por email canónico)
  leadsPorEmail: Record<string, number>
  leadsHoyPorEmail: Record<string, number>
  // Si es VENDEDOR, oculta comisiones ajenas
  ocultarComisionAjena: boolean
  asesorIdActual?: string | null
}): FilaRanking[] {
  const {
    asesores,
    pagosActual,
    pagosAnterior,
    leadsPorEmail,
    leadsHoyPorEmail,
    ocultarComisionAjena,
    asesorIdActual,
  } = args

  const hoy = hoyColombia()

  // Pre-indexar pagos para no recorrer N×M
  const pagosPorAsesor = new Map<string, PagoAsesor[]>()
  const pagosAntPorAsesor = new Map<string, PagoAsesor[]>()
  for (const p of pagosActual) {
    if (!p.asesorId) continue
    const arr = pagosPorAsesor.get(p.asesorId) ?? []
    arr.push(p)
    pagosPorAsesor.set(p.asesorId, arr)
  }
  for (const p of pagosAnterior) {
    if (!p.asesorId) continue
    const arr = pagosAntPorAsesor.get(p.asesorId) ?? []
    arr.push(p)
    pagosAntPorAsesor.set(p.asesorId, arr)
  }

  // Primera pasada: cálculos base por asesor (sin score, no sabemos máximo aún)
  type Borrador = FilaRanking & { _ventas: number }
  const borrador: Borrador[] = asesores.map(a => {
    const pagos = pagosPorAsesor.get(a.id) ?? []
    const ventasActual = pagos.reduce((s, p) => s + p.monto, 0)
    const ventasAnt    = (pagosAntPorAsesor.get(a.id) ?? []).reduce((s, p) => s + p.monto, 0)
    const variacion    = ventasAnt > 0 ? Math.round(((ventasActual - ventasAnt) / ventasAnt) * 100) : 0
    const estudiantesPeriodo = new Set(pagos.map(p => p.estudianteId).filter(Boolean) as string[]).size
    const comision = pagos.reduce((s, p) => s + (p.comisionAsesor ?? 0), 0)
    const ventasHoy = pagos.filter(p => p.fechaPago && diaColombia(p.fechaPago) === hoy).length

    const k = emailKey(a.email)
    const leads    = leadsPorEmail[k] ?? 0
    const leadsHoy = leadsHoyPorEmail[k] ?? 0
    // Tasa de cierre = ventas / leads del MISMO período.
    // Si supera 100% es señal de datos aún no comparables (más ventas que
    // leads registrados en el período); en ese caso mostramos null ("—").
    const tcRaw    = leads > 0 ? (pagos.length / leads) * 100 : null
    const tasaCierre    = tcRaw !== null && tcRaw <= 100 ? tcRaw : null
    const tcHoyRaw = leadsHoy > 0 ? (ventasHoy / leadsHoy) * 100 : null
    const tasaCierreHoy = tcHoyRaw !== null && tcHoyRaw <= 100 ? tcHoyRaw : null

    const esYo = !!asesorIdActual && a.id === asesorIdActual

    return {
      id: a.id,
      nombre: a.nombre,
      image: a.image,
      totalVentas: ventasActual,
      cobrado: ventasActual,
      cantidadPagos: pagos.length,
      totalEstudiantes: estudiantesPeriodo,
      comisionGanada: ocultarComisionAjena && !esYo ? null : comision,
      variacion,
      ventasAnterior: ventasAnt,
      leads,
      leadsHoy,
      ventasHoy,
      tasaCierre,
      tasaCierreHoy,
      score: null,
      esYo,
      _ventas: ventasActual,
    }
  })

  // Score: necesitamos el máximo de ventas del período
  const maxVentas = borrador.reduce((m, b) => Math.max(m, b._ventas), 0)
  for (const b of borrador) {
    b.score = calcularScore(b.tasaCierre, b._ventas, maxVentas)
  }

  // Ordenar por VENTAS (monto): el ranking refleja quién más vendió.
  // El score y la tasa de cierre son columnas informativas, no el orden.
  const ordenado = borrador.sort((a, b) => b.totalVentas - a.totalVentas)

  // Quitar el campo interno _ventas
  return ordenado.map(({ _ventas: _ignored, ...resto }) => resto)
}
