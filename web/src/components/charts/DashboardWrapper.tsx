'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { FinancieroSection } from './FinancieroSection'
import { EstudiantesMes } from './EstudiantesMes'
import { CursosVendidosChart } from './CursosVendidosChart'
import { Bell } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

function getRangeFromMonth(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return {
    desde: toISO(startOfMonth(base)),
    hasta: toISO(endOfMonth(base)),
  }
}

interface Props {
  firstName: string
  saludo: string
}

export function DashboardWrapper({ firstName, saludo }: Props) {
  const now          = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  const [month,     setMonth]     = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  function handleChange(m: string | null, r: DateRange | null) {
    setMonth(m)
    setDateRange(r)
  }

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : getRangeFromMonth(month)

  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtShort = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const periodoLabel = desde === hasta
    ? fmt(desde)
    : desde.slice(0, 4) === hasta.slice(0, 4)
      ? `${fmtShort(desde)} – ${fmt(hasta)}`
      : `${fmt(desde)} – ${fmt(hasta)}`

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">
            <span className="md:hidden">{saludo},<br />{firstName} 👋</span>
            <span className="hidden md:inline">{saludo}, {firstName} 👋</span>
          </h1>
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Período de análisis</p>
            <p className="text-[13px] font-semibold text-on-surface capitalize leading-tight mt-0.5">{periodoLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <MonthPicker
            value={month}
            currentMonth={currentMonth}
            dateRange={dateRange}
            onChange={handleChange}
            alignRight
            iconOnly
          />
          <button className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <RefreshButton />
        </div>
      </div>

      {/* ── Financiero ── */}
      <FinancieroSection desde={desde} hasta={hasta} />

      {/* ── Estudiantes por mes + Cursos más vendidos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EstudiantesMes desde={desde} hasta={hasta} />
        <CursosVendidosChart desde={desde} hasta={hasta} />
      </div>
    </div>
  )
}
