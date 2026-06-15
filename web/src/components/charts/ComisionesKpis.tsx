'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Landmark, Users, Wallet } from 'lucide-react'

interface Desglose { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }

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
    { label: 'Comisión Hotmart',  valor: d.comisionHotmart, color: isDark ? '#fbbf24' : '#d97706', Icon: Landmark, negativo: true },
    { label: 'Comisión asesores', valor: d.comisionAsesor,  color: isDark ? '#f87171' : '#dc2626', Icon: Users,    negativo: true },
    { label: 'Neto recibido',     valor: d.neto,            color: isDark ? '#6ee7b7' : '#16a34a', Icon: Wallet,   negativo: false },
  ]

  return (
    <div className="flex flex-col gap-3 h-full">
      {cards.map(({ label, valor, color, Icon, negativo }) => (
        <div key={label} className="rounded-2xl p-4 flex-1 flex flex-col justify-center"
          style={{ border: `1.5px solid ${color}66`, background: `${color}22` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}26` }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-[12px] font-medium text-on-surface-variant leading-tight">{label}</span>
          </div>
          {isLoading
            ? <div className="h-6 w-28 rounded bg-[var(--surface-high)] animate-pulse" />
            : <p className="text-[18px] font-bold tabular-nums" style={{ color }}>{negativo ? '−' : ''}{formatCOP(valor)}</p>}
        </div>
      ))}
    </div>
  )
}
