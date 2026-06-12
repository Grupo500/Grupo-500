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

  return (
    <div className="space-y-5">

      {/* ── Selector de período global ── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface-variant">Período de análisis</p>
        <MonthPicker
          value={month}
          currentMonth={currentMonth}
          dateRange={dateRange}
          onChange={handleChange}
          alignRight
        />
      </div>

      {/* ── Financiero ── */}
      <FinancieroSection desde={desde} hasta={hasta} />

      {/* ── Estudiantes por mes + Cursos más vendidos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EstudiantesMes />
        <CursosVendidosChart desde={desde} hasta={hasta} />
      </div>

      {/* ── Saldos pendientes ── */}
      <SaldosPendientes />

    </div>
  )
}
