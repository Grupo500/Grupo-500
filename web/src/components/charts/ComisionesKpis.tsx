'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Landmark, Users, Wallet } from 'lucide-react'

interface Desglose { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }

/**
 * Recibo de liquidación del periodo: los dos descuentos y la línea de total.
 * Una sola tarjeta que se lee como cuenta de cobro — la resta se entiende
 * sola, y el neto (el número que importa) cierra con el mayor peso visual.
 */
export function ComisionesKpis({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', desde, hasta],
    queryFn: () => apiFetch(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`) as Promise<{ data: { desglose?: Desglose } }>,
    staleTime: 30_000,
  })

  const d = data?.data?.desglose ?? { bruto: 0, comisionHotmart: 0, comisionAsesor: 0, neto: 0 }

  const ambar = isDark ? '#fbbf24' : '#b45309'
  const rojo = isDark ? '#f87171' : '#b91c1c'
  const verde = isDark ? '#6ee7b7' : '#15803d'

  const descuentos = [
    { label: 'Comisión Hotmart', valor: d.comisionHotmart, color: ambar, Icon: Landmark },
    { label: 'Comisión asesores', valor: d.comisionAsesor, color: rojo, Icon: Users },
  ]

  return (
    <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-4 md:h-full flex flex-col justify-center">
      {descuentos.map(({ label, valor, color, Icon }, i) => (
        <div
          key={label}
          className={`flex items-center justify-between gap-2 py-2.5 ${i > 0 ? 'border-t border-dashed border-[var(--outline)]' : ''}`}
        >
          <span className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant min-w-0">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f` }}>
              <Icon className="w-3 h-3" style={{ color }} />
            </span>
            {label}
          </span>
          {isLoading
            ? <span className="h-4 w-20 rounded bg-[var(--surface-high)] animate-pulse" />
            : <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color }}>−{formatCOP(valor)}</span>}
        </div>
      ))}

      {/* Línea de total: borde sólido más marcado, como el total de un recibo. */}
      <div className="flex items-center justify-between gap-2 pt-3 mt-0.5 border-t-2 border-[var(--outline-variant)]">
        <span className="flex items-center gap-2 text-[12px] font-bold text-on-surface min-w-0">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${verde}1f` }}>
            <Wallet className="w-3 h-3" style={{ color: verde }} />
          </span>
          Neto recibido
        </span>
        {isLoading
          ? <span className="h-6 w-28 rounded bg-[var(--surface-high)] animate-pulse" />
          : <span className="text-[17px] font-bold tabular-nums whitespace-nowrap" style={{ color: verde }}>{formatCOP(d.neto)}</span>}
      </div>
    </div>
  )
}
