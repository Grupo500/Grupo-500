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
    { label: 'Comisión Hotmart',  valor: d.comisionHotmart, color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? '#2d1f00' : '#fef3e2', border: isDark ? '#78450080' : '#d9770640', Icon: Landmark, negativo: true },
    { label: 'Comisión asesores', valor: d.comisionAsesor,  color: isDark ? '#f87171' : '#dc2626', bg: isDark ? '#2d0000' : '#feecec', border: isDark ? '#7f000080' : '#dc262640', Icon: Users,    negativo: true },
    { label: 'Neto recibido',     valor: d.neto,            color: isDark ? '#6ee7b7' : '#16a34a', bg: isDark ? '#002d0a' : '#edfdf4', border: isDark ? '#00462080' : '#16a34a40', Icon: Wallet,   negativo: false },
  ]

  return (
    <div className="grid grid-cols-2 md:flex md:flex-col gap-3 md:h-full">
      {cards.map(({ label, valor, color, bg, border, Icon, negativo }, i) => {
        const esNeto = i === 2
        return (
          <div key={label}
            className={`rounded-2xl p-4 flex flex-col justify-center items-center text-center md:items-stretch md:text-left md:flex-1 ${esNeto ? 'col-span-2 md:col-span-1' : ''}`}
            style={{ border: `1.5px solid ${border}`, background: bg }}>
            <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}26` }}>
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
