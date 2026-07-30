'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Landmark, Users, Wallet } from 'lucide-react'

interface Desglose { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }

/**
 * Las tres tarjetas de comisiones junto a la gráfica de facturación: los dos
 * descuentos y el neto. Tarjetas blancas como el resto del dashboard; el
 * color vive solo en el ícono y la cifra.
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

  const cards = [
    { label: 'Comisión Hotmart',  valor: d.comisionHotmart, color: isDark ? '#fbbf24' : '#b45309', Icon: Landmark, negativo: true },
    { label: 'Comisión asesores', valor: d.comisionAsesor,  color: isDark ? '#f87171' : '#b91c1c', Icon: Users,    negativo: true },
    { label: 'Neto recibido',     valor: d.neto,            color: isDark ? '#6ee7b7' : '#15803d', Icon: Wallet,   negativo: false },
  ]

  return (
    <div className="grid grid-cols-2 md:flex md:flex-col gap-3 md:h-full">
      {cards.map(({ label, valor, color, Icon, negativo }, i) => {
        const esNeto = i === 2
        return (
          <div key={label}
            className={`card p-4 flex flex-col justify-center items-center text-center md:items-stretch md:text-left md:flex-1 ${esNeto ? 'col-span-2 md:col-span-1' : ''}`}>
            <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}1f` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[12px] font-medium text-on-surface-variant leading-tight">{label}</span>
            </div>
            {isLoading
              ? <div className="h-6 w-28 rounded bg-[var(--surface-high)] animate-pulse" />
              : <p className="text-[18px] font-bold tabular-nums" style={{ color }}>{negativo ? '−' : ''}{formatCOP(valor)}</p>}
          </div>
        )
      })}
    </div>
  )
}
