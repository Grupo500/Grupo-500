'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Landmark, Users, Wallet } from 'lucide-react'

interface Desglose { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }

/**
 * La tarjeta "Desglose del mes" del dashboard: bruta − Hotmart − asesores =
 * neto, en una sola cuenta legible. Reemplaza a las tres tarjetas KPI sueltas
 * que vivían junto a la gráfica (pedido de Hotman, 19-ago): tres cifras
 * apiladas sin el bruto no contaban la historia — esto es una resta y se lee
 * como tal. Mismo diseño que su gemela de Analíticas.
 */
export function DesgloseMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', desde, hasta],
    queryFn: () => apiFetch(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`) as Promise<{ data: { desglose?: Desglose } }>,
    staleTime: 30_000,
  })

  const d = data?.data?.desglose ?? { bruto: 0, comisionHotmart: 0, comisionAsesor: 0, neto: 0 }

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--primary-container)' }}>
          <Wallet className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[13px] font-semibold text-on-surface">Desglose del mes</h3>
      </div>

      {isLoading
        ? <div className="space-y-3 flex-1">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-5 rounded bg-surface-high animate-pulse" />)}
          </div>
        : <div className="space-y-3 flex-1 flex flex-col justify-center animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-on-surface-variant">Facturación bruta</span>
              <span className="text-[13px] font-bold text-on-surface tabular-nums whitespace-nowrap">{formatCOP(d.bruto)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-on-surface-variant flex items-center gap-1 whitespace-nowrap">
                <Landmark className="w-3 h-3" /> Comisión Hotmart
              </span>
              <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#d97706' }}>
                −{formatCOP(d.comisionHotmart)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-on-surface-variant flex items-center gap-1 whitespace-nowrap">
                <Users className="w-3 h-3" /> Comisión asesores
              </span>
              <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#dc2626' }}>
                −{formatCOP(d.comisionAsesor)}
              </span>
            </div>
            <div className="border-t border-outline-variant pt-3 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface">Neto recibido</span>
              <span className="text-[18px] font-bold tabular-nums whitespace-nowrap" style={{ color: '#16a34a' }}>
                {formatCOP(d.neto)}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant leading-relaxed pt-1">
              Neto estimado a TRM oficial; puede variar levemente del depósito real de Hotmart.
            </p>
          </div>
      }
    </div>
  )
}
