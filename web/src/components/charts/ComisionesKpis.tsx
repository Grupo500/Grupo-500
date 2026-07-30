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
    <div className="card p-5 md:h-full flex flex-col">
      {/* Misma cabecera que las demás tarjetas del dashboard: chip de ícono
          en el contenedor primario y título en 15px seminegrita. */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <Wallet className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Comisiones</h3>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {descuentos.map(({ label, valor, color }, i) => (
          <div
            key={label}
            className={`py-2.5 ${i > 0 ? 'border-t border-dashed border-[var(--outline-variant)]' : ''}`}
          >
            <span className="block text-[11px] text-on-surface-variant">{label}</span>
            {isLoading
              ? <span className="block h-4 w-24 rounded bg-[var(--surface-high)] animate-pulse mt-1" />
              : <span className="block text-[14px] font-semibold tabular-nums mt-0.5" style={{ color }}>−{formatCOP(valor)}</span>}
          </div>
        ))}

        {/* Línea de total: borde sólido más marcado, como el total de un recibo. */}
        <div className="pt-3 mt-0.5 border-t-2 border-[var(--outline-variant)]">
          <span className="block text-[11px] font-medium text-on-surface">Neto recibido</span>
          {isLoading
            ? <span className="block h-6 w-28 rounded bg-[var(--surface-high)] animate-pulse mt-1" />
            : <span className="block text-[17px] font-bold tabular-nums mt-0.5" style={{ color: verde }}>{formatCOP(d.neto)}</span>}
        </div>
      </div>
    </div>
  )
}
