'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { Select } from '@/components/ui/Select'
import { Link2, Loader2 } from 'lucide-react'

interface Entregable {
  id: string
  plataforma: string
  url: string | null
  videoUrl: string | null
  publicadoEn: string
  contenido: {
    titulo: string
    tipo: string
    asignadoA: { nombre: string } | null
  }
}

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function getRangeFromMonth(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}

const PLATAFORMAS = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO']

export default function EntregablesPage() {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')
  const [month, setMonth] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [plataforma, setPlataforma] = useState('')

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : getRangeFromMonth(month)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-entregables', desde, hasta, plataforma],
    queryFn: () => apiFetch<{ data: Entregable[] }>(
      `/marketing/entregables?desde=${desde}&hasta=${hasta}${plataforma ? `&plataforma=${plataforma}` : ''}`
    ),
    staleTime: 30_000,
  })
  const entregables = data?.data ?? []

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Entregables" subtitle="Todo lo que el equipo ha publicado" />
        <div className="flex items-center gap-2">
          <Select
            value={plataforma}
            onValueChange={setPlataforma}
            placeholder="Todas las plataformas"
            className="w-[180px]"
            options={[{ value: '', label: 'Todas las plataformas' }, ...PLATAFORMAS.map(p => ({ value: p, label: p }))]}
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

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : entregables.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-16">Sin entregables publicados en este período.</p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {entregables.map(e => (
              <a
                key={e.id}
                href={e.url ?? e.videoUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-high/60 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                  <Link2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{e.contenido.titulo}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {e.contenido.asignadoA?.nombre ?? 'Sin asignar'} · {format(new Date(e.publicadoEn), "d 'de' MMMM", { locale: es })}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-surface-high text-on-surface-variant shrink-0">
                  {e.plataforma}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
