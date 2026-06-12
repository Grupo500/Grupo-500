'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { FinancieroSection } from './FinancieroSection'
import { EstudiantesMes } from './EstudiantesMes'
import { CursosVendidosChart } from './CursosVendidosChart'
import { SaldosPendientes } from './SaldosPendientes'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

function getRangeFromMonth(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return {
    desde: toISO(startOfMonth(base)),
    hasta: toISO(endOfMonth(base)),
  }
}

export function DashboardAnalytics() {
  const now          = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  const [month,     setMonth]     = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  function handleChange(m: string | null, r: DateRange | null) {
    setMonth(m)
    setDateRange(r)
  }

  // Calcular desde/hasta según selección
  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : getRangeFromMonth(month)

  // Label de fechas para mostrar debajo del picker
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtShort = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const periodoLabel = desde === hasta
    ? fmt(desde)
    : desde.slice(0, 4) === hasta.slice(0, 4)
      ? `${fmtShort(desde)} – ${fmt(hasta)}`
      : `${fmt(desde)} – ${fmt(hasta)}`

  return (
    <div className="space-y-5">

      {/* ── Selector de período global ── */}
      <div>
        <MonthPicker
          value={month}
          currentMonth={currentMonth}
          dateRange={dateRange}
          onChange={handleChange}
        />
        <div className="mt-1.5">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Período de análisis</p>
          <p className="text-[15px] font-semibold text-on-surface capitalize leading-tight">{periodoLabel}</p>
        </div>
      </div>

      {/* ── Financiero ── */}
      <FinancieroSection desde={desde} hasta={hasta} />

      {/* ── Estudiantes por mes + Cursos más vendidos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EstudiantesMes desde={desde} hasta={hasta} />
        <CursosVendidosChart desde={desde} hasta={hasta} />
      </div>

      {/* ── Saldos pendientes ── */}
      <SaldosPendientes />

    </div>
  )
}
