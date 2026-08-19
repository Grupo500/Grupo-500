'use client'

import Link from 'next/link'
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

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

interface Props {
  firstName: string
  saludo: string
  esAdmin?: boolean
}

export function DashboardWrapper({ firstName, saludo, esAdmin }: Props) {
  const now   = new Date()
  const desde = toISO(startOfMonth(now))
  const hasta = toISO(endOfMonth(now))
  const mesRaw   = format(now, "MMMM 'de' yyyy", { locale: es })
  const mesLabel = mesRaw.charAt(0).toUpperCase() + mesRaw.slice(1)

  return (
    <div className="space-y-4 animate-fade-in">

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
          {/* Ventas generales se mudó a Administración. Sin este atajo, un
              administrador se quedaba sin ninguna lista de ventas dentro del
              área donde están los estudiantes que las generan. */}
          {esAdmin && (
            <Link href="/admin/ventas" className="ml-1 text-[11px] text-primary hover:underline">
              Ver todas las ventas
            </Link>
          )}
        </p>
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

      {/* Fila 3: estudiantes · pendiente por cobrar · cursos. Pendiente va al
          centro y más ancha: es la que más información carga. Los cursos son
          la versión de barras de Analíticas (pedido expreso), no la torta. */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:items-stretch">
        <div className="lg:col-span-3">
          <EstudiantesMes desde={desde} hasta={hasta} />
        </div>
        <div className="lg:col-span-4">
          {/* Saldos abiertos — no depende del mes elegido, es el total vigente */}
          <PendientesPorCobrar />
        </div>
        <div className="lg:col-span-3">
          <CursosVendidosRanked desde={desde} hasta={hasta} />
        </div>
      </div>
    </div>
  )
}
