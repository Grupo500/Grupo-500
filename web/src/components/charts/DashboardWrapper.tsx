'use client'

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { EstudiantesMes } from './EstudiantesMes'
import { CursosVendidosChart } from './CursosVendidosChart'
import { FacturadoMensual } from './FacturadoMensual'
import { ComisionesKpis } from './ComisionesKpis'
import { TopAsesores } from './TopAsesores'
import { RefreshButton } from '@/components/ui/RefreshButton'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

interface Props {
  firstName: string
  saludo: string
}

export function DashboardWrapper({ firstName, saludo }: Props) {
  const now   = new Date()
  const desde = toISO(startOfMonth(now))
  const hasta = toISO(endOfMonth(now))
  const mesRaw   = format(now, "MMMM 'de' yyyy", { locale: es })
  const mesLabel = mesRaw.charAt(0).toUpperCase() + mesRaw.slice(1)

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">
            <span className="md:hidden">{saludo},<br />{firstName} 👋</span>
            <span className="hidden md:inline">{saludo}, {firstName} 👋</span>
          </h1>
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-on-surface-variant tracking-wide">Resumen del mes</p>
            <p className="text-[13px] font-semibold text-on-surface leading-tight mt-0.5">{mesLabel}</p>
          </div>
        </div>
        <div className="flex-shrink-0 pt-1">
          <RefreshButton />
        </div>
      </div>

      {/* ── Layout 30 / 70 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:items-stretch">

        {/* Columna lateral (30%) — en móvil va después de la principal */}
        <div className="lg:col-span-3 order-2 lg:order-1 flex flex-col gap-4">
          <EstudiantesMes desde={desde} hasta={hasta} />
          <div className="flex-1">
            <CursosVendidosChart desde={desde} hasta={hasta} />
          </div>
        </div>

        {/* Columna principal (70%) */}
        <div className="lg:col-span-7 order-1 lg:order-2 flex flex-col gap-4">
          {/* Móvil: apilado · Desktop: gráfica + KPIs lado a lado */}
          <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
            <div className="flex-1 min-w-0">
              <FacturadoMensual />
            </div>
            <div className="lg:flex-shrink-0 lg:w-44">
              <ComisionesKpis desde={desde} hasta={hasta} />
            </div>
          </div>
          <div className="flex-1">
            <TopAsesores />
          </div>
        </div>

      </div>
    </div>
  )
}
