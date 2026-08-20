'use client'

/**
 * Entregables — el trabajo del mes, persona por persona.
 *
 * Antes esta pantalla listaba solo enlaces ya publicados, en una sola tira
 * ordenada por fecha: servía para "¿qué salió en agosto?" pero no para lo que
 * de verdad se pregunta a diario, que es quién tiene qué pendiente. Ahora cada
 * bloque es una persona y sus tareas del período, con el enlace al lado cuando
 * ya está publicado.
 *
 * Los datos son los del calendario (`/marketing/contenidos`), no la tabla de
 * entregables: una tarea existe desde que se asigna, y el entregable aparece
 * solo al final. Filtrar por entregables dejaba fuera justo lo pendiente.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Link2, Loader2, HelpCircle, CheckCircle2, Circle, Clock } from 'lucide-react'
import { type Contenido } from '@/components/marketing/CalendarioMarketing'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'

const TIPO_LABEL: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme', TIKTOKERO: 'TikTokero',
  GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
const PLATAFORMA_LABEL: Record<string, string> = {
  YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook', DRIVE: 'Drive', OTRO: 'Otro',
}
const ESTADO = {
  PLANIFICADO: { label: 'Planificado', color: 'var(--outline)', icono: Circle },
  EN_PROCESO:  { label: 'En proceso',  color: '#d97706',        icono: Clock },
  PUBLICADO:   { label: 'Publicado',   color: '#16a34a',        icono: CheckCircle2 },
} as const

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function rangoDelMes(month: string | null) {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}
/**
 * La fecha viene como YYYY-MM-DD a medianoche UTC. Pasarla por `new Date()`
 * la corre al día anterior en Colombia (UTC-5), así que se ancla a medianoche
 * local igual que en el calendario.
 */
function deISO(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Una tarea. El enlace solo aparece cuando ya hay algo publicado. */
function Tarea({ c }: { c: Contenido }) {
  const e = ESTADO[c.estado]
  const Icono = e.icono
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icono className="size-3.5 shrink-0" style={{ color: e.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-on-surface">{c.titulo}</p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          {TIPO_LABEL[c.tipo]} · {format(deISO(c.fecha), "d 'de' MMM", { locale: es })}
          {c.tipoTrabajo === 'FREELANCE' && ' · Freelance'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.entregables.map(en => (
          <a
            key={en.id}
            href={en.url ?? en.videoUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-surface-high px-2 py-1 text-[10px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <Link2 className="size-3" />
            {PLATAFORMA_LABEL[en.plataforma] ?? en.plataforma}
          </a>
        ))}
        {c.entregables.length === 0 && (
          <span className="text-[10px] font-semibold" style={{ color: e.color }}>{e.label}</span>
        )}
      </div>
    </div>
  )
}

/** Cuántas tareas se ven en la tarjeta antes de mandar el resto al modal. */
const VISIBLES = 5

type Grupo = { id: string; nombre: string; foto: string | null; tareas: Contenido[] }

export default function EntregablesPage() {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')
  const [month, setMonth] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [filtro, setFiltro] = useState<'' | 'PENDIENTE' | 'PUBLICADO'>('')
  const [verTodas, setVerTodas] = useState<Grupo | null>(null)

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : rangoDelMes(month)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-contenidos-equipo', desde, hasta],
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  // Agrupado por persona, y los que nadie tomó al final: no es una persona
  // más, es una alerta — algo agendado que no tiene quién lo haga.
  const grupos = useMemo(() => {
    const todos = data?.data ?? []
    const visibles = todos.filter(c =>
      filtro === '' ? true
      : filtro === 'PUBLICADO' ? c.estado === 'PUBLICADO'
      : c.estado !== 'PUBLICADO',
    )
    const mapa = new Map<string, Grupo>()
    for (const c of visibles) {
      const id = c.asignadoA?.id ?? '__sin__'
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin responsable',
        foto: c.asignadoA?.user?.image ?? null,
        tareas: [],
      })
      mapa.get(id)!.tareas.push(c)
    }
    return [...mapa.values()].sort((a, b) =>
      a.id === '__sin__' ? 1 : b.id === '__sin__' ? -1 : a.nombre.localeCompare(b.nombre),
    )
  }, [data, filtro])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Entregables" subtitle="Las tareas de cada quien y lo que ya publicó" />
        <div className="flex items-center gap-2">
          <Select
            value={filtro}
            onValueChange={v => setFiltro(v as typeof filtro)}
            className="w-[160px]"
            options={[
              { value: '',           label: 'Todo' },
              { value: 'PENDIENTE',  label: 'Pendiente' },
              { value: 'PUBLICADO',  label: 'Publicado' },
            ]}
          />
          <MonthPicker
            value={month}
            currentMonth={currentMonth}
            dateRange={dateRange}
            onChange={(m, r) => { setMonth(m); setDateRange(r) }}
            alignRight
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="card py-16 text-center text-[13px] text-on-surface-variant">
          Nada agendado en este período.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {grupos.map(g => {
            const sinDueno   = g.id === '__sin__'
            const publicados = g.tareas.filter(t => t.estado === 'PUBLICADO').length
            const pendientes = g.tareas.length - publicados
            return (
              <div key={g.id} className="card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-outline-variant px-4 py-3">
                  {sinDueno
                    ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-high">
                        <HelpCircle className="size-4 text-on-surface-variant" />
                      </span>
                    : <AvatarMiembro id={g.id} nombre={g.nombre} image={g.foto} size={32} />}
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">{g.nombre}</p>
                  <p className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">
                    {pendientes > 0 && <span className="font-semibold text-[#d97706]">{pendientes} pend.</span>}
                    {pendientes > 0 && publicados > 0 && ' · '}
                    {publicados > 0 && <span className="font-semibold text-[#16a34a]">{publicados} publ.</span>}
                  </p>
                </div>
                {/* Solo las 5 más recientes: con diez y pico tareas la tarjeta
                    de una persona estiraba la página y descuadraba la columna
                    de al lado. El resto se ve completo en el modal (Hotman,
                    20-ago). */}
                <div className="divide-y divide-outline-variant/50">
                  {g.tareas.slice(0, VISIBLES).map(t => <Tarea key={t.id} c={t} />)}
                </div>
                {g.tareas.length > VISIBLES && (
                  <button
                    type="button"
                    onClick={() => setVerTodas(g)}
                    className="w-full cursor-pointer border-t border-outline-variant px-4 py-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-surface-low"
                  >
                    Ver las {g.tareas.length} tareas
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Todas las tareas de una persona, sin recortar */}
      <Modal
        abierto={!!verTodas}
        onClose={() => setVerTodas(null)}
        titulo={verTodas?.nombre ?? ''}
        subtitulo={verTodas
          ? `${verTodas.tareas.length} tarea${verTodas.tareas.length !== 1 ? 's' : ''} en el período`
          : ''}
      >
        <div className="divide-y divide-outline-variant/50">
          {verTodas?.tareas.map(t => <Tarea key={t.id} c={t} />)}
        </div>
      </Modal>
    </div>
  )
}
