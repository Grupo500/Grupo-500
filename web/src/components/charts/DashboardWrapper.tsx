'use client'

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { EstudiantesMes } from './EstudiantesMes'
// La versión de barras de Analíticas (pedido de Hotman, 19-ago): en la fila
// inferior de tres tarjetas el alto variable ya no rompe ninguna columna.
import { CursosVendidosRanked } from './CursosVendidosRanked'
import { FacturadoMensual } from './FacturadoMensual'
import { DesgloseMes } from './DesgloseMes'
import { TopAsesores } from './TopAsesores'
import { PendientesPorCobrar } from './PendientesPorCobrar'
import { AccionesPortada } from '@/components/layout/AccionesPortada'

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

      {/* En celular los tres botones del header viven en este renglón. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
        {/* Un renglón también en el teléfono. El salto de línea forzado partía
            el saludo en dos y le comía dos dedos de alto a la pantalla más
            corta; a 19px la frase entra entera (Hotman, 21-ago). */}
        <h1 className="text-[19px] sm:text-[22px] font-bold text-on-surface tracking-tight leading-tight">
          {saludo}, {firstName} 👋
        </h1>
        {/* En una sola fila: son dos mitades de la misma frase, no dos datos.
            Alineadas por la línea base y no por el centro, que es lo que las
            deja parejas de verdad teniendo tamaños distintos. */}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-tight">
          <span className="text-[11px] font-semibold text-on-surface-variant tracking-wide">Resumen del mes</span>
          <span className="text-[11px] text-outline">·</span>
          <span className="text-[13px] font-semibold text-on-surface">{mesLabel}</span>
        </p>
        </div>

        <AccionesPortada />
      </div>

      {/* ── Rediseño (Hotman, 19-ago): la gráfica toma todo el ancho arriba y
          las tarjetas que antes vivían en la columna izquierda bajan a una
          fila de tres junto a Pendiente por cobrar. ── */}

      {/* Fila 1: gráfica ancha + desglose del mes */}
      <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
        <div className="flex-1 min-w-0">
          <FacturadoMensual />
        </div>
        {/* El desglose completo (bruta − comisiones = neto) en una sola
            tarjeta: es una resta y se lee como tal. */}
        <div className="md:flex-shrink-0 md:w-72">
          <DesgloseMes desde={desde} hasta={hasta} />
        </div>
      </div>

      {/* Fila 2: top asesores a lo ancho */}
      <TopAsesores />

      {/* Fila 3: estudiantes y cursos a mitades. Los cursos son la versión de
          barras de Analíticas (pedido expreso), no la torta. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-stretch">
        <EstudiantesMes desde={desde} hasta={hasta} />
        <CursosVendidosRanked desde={desde} hasta={hasta} />
      </div>

      {/* Fila 4 (última, a lo ancho): saldos abiertos — no depende del mes
          elegido, es el total vigente. Sola en su fila (Hotman, 19-ago). */}
      <PendientesPorCobrar />
    </div>
  )
}
