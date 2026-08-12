'use client'

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { EstudiantesMes } from './EstudiantesMes'
// La torta y no la tabla de Analíticas: su alto es fijo, así que la columna
// izquierda termina a la misma altura que el Top 5 de la derecha. La tabla
// crece según cuántas familias tengan ventas y dejaba un hueco abajo.
import { CursosVendidosChart } from './CursosVendidosChart'
import { FacturadoMensual } from './FacturadoMensual'
import { ComisionesKpis } from './ComisionesKpis'
import { TopAsesores } from './TopAsesores'
import { PendientesPorCobrar } from './PendientesPorCobrar'

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

      {/* Saludo y periodo. Los botones de inicio, notificaciones, tema y
          refrescar se fueron al header del área, donde acompañan a todas las
          pantallas y no solo a esta. */}
      <div>
        <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">
          <span className="md:hidden">{saludo},<br />{firstName} 👋</span>
          <span className="hidden md:inline">{saludo}, {firstName} 👋</span>
        </h1>
        {/* En una sola fila: son dos mitades de la misma frase, no dos datos.
            Alineadas por la línea base y no por el centro, que es lo que las
            deja parejas de verdad teniendo tamaños distintos. */}
        <p className="mt-2 flex items-baseline gap-1.5 leading-tight">
          <span className="text-[11px] font-semibold text-on-surface-variant tracking-wide">Resumen del mes</span>
          <span className="text-[11px] text-outline">·</span>
          <span className="text-[13px] font-semibold text-on-surface">{mesLabel}</span>
        </p>
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
          {/* Móvil: apilado · Tablet+: gráfica + KPIs lado a lado */}
          <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
            <div className="flex-1 min-w-0">
              <FacturadoMensual />
            </div>
            <div className="md:flex-shrink-0 md:w-44">
              <ComisionesKpis desde={desde} hasta={hasta} />
            </div>
          </div>
          <div className="flex-1">
            <TopAsesores />
          </div>
        </div>

      </div>

      {/* Saldos abiertos — no depende del mes elegido arriba, es el total vigente */}
      <PendientesPorCobrar />
    </div>
  )
}
