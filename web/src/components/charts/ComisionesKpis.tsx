'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { format, startOfMonth, subMonths } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Landmark, Users, Wallet } from 'lucide-react'

interface Desglose { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }

/**
 * Las tres tarjetas de comisiones junto a la gráfica de facturación: los dos
 * descuentos y el neto. El color vive solo en el ícono, nunca en la cifra —
 * un texto rojo/naranja se lee como alerta, y una comisión no es un error,
 * es un dato. El signo +/− ya dice si suma o resta.
 */
export function ComisionesKpis({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', desde, hasta],
    queryFn: () => apiFetch(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`) as Promise<{ data: { desglose?: Desglose } }>,
    staleTime: 30_000,
  })

  // Mismo corte de días que el resto del dashboard (Nuevos estudiantes, Total
  // facturado): se compara contra los primeros N días del mes anterior, no
  // contra el mes anterior completo, o a mitad de mes la variación siempre
  // se ve como una caída enorme.
  const hoy = new Date()
  const mesAnt = subMonths(hoy, 1)
  const inicioAnt = format(startOfMonth(mesAnt), 'yyyy-MM-dd')
  const corteAnt = format(new Date(mesAnt.getFullYear(), mesAnt.getMonth(), hoy.getDate()), 'yyyy-MM-dd')

  const { data: antData } = useQuery({
    queryKey: ['reportes-dashboard', inicioAnt, corteAnt],
    queryFn: () => apiFetch(`/reportes/dashboard?desde=${inicioAnt}&hasta=${corteAnt}`) as Promise<{ data: { desglose?: Desglose } }>,
    staleTime: 30_000,
  })

  const d    = data?.data?.desglose ?? { bruto: 0, comisionHotmart: 0, comisionAsesor: 0, neto: 0 }
  const dAnt = antData?.data?.desglose ?? { bruto: 0, comisionHotmart: 0, comisionAsesor: 0, neto: 0 }

  const variar = (actual: number, previo: number) =>
    previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null

  // El ícono usa el azul del sistema, igual que Nuevos estudiantes y Cursos
  // más vendidos: es identificación de la tarjeta, no un estado. Darle un
  // color propio a cada una hacía que la fila se leyera como un semáforo.
  const cards = [
    {
      label: 'Comisión Hotmart', valor: d.comisionHotmart, negativo: true,
      Icon: Landmark,
      variacion: variar(d.comisionHotmart, dAnt.comisionHotmart),
    },
    {
      label: 'Comisión asesores', valor: d.comisionAsesor, negativo: true,
      Icon: Users,
      variacion: variar(d.comisionAsesor, dAnt.comisionAsesor),
    },
    {
      label: 'Neto recibido', valor: d.neto, negativo: false,
      Icon: Wallet,
      variacion: variar(d.neto, dAnt.neto),
    },
  ]

  return (
    <div className="grid grid-cols-2 md:flex md:flex-col gap-3 md:h-full">
      {cards.map(({ label, valor, Icon, negativo, variacion }, i) => {
        const esNeto = i === 2
        // Mismo código de color que el resto del dashboard (Nuevos
        // estudiantes, Total facturado): sube en verde, baja en rojo.
        const deltaColor = variacion == null || variacion === 0
          ? 'var(--on-surface-variant)'
          : variacion > 0 ? (isDark ? '#6ee7b7' : '#16a34a') : (isDark ? '#f87171' : '#dc2626')
        const deltaTexto = variacion == null
          ? 'Sin mes anterior para comparar'
          : variacion === 0
            ? 'Igual que el mes pasado'
            : `${variacion > 0 ? '▲ +' : '▼ '}${variacion}% vs mes anterior`

        return (
          <div key={label}
            className={`card p-4 flex flex-col justify-center items-center text-center md:items-stretch md:text-left md:flex-1 ${esNeto ? 'col-span-2 md:col-span-1' : ''}`}>
            <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
              <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[12px] font-semibold text-on-surface leading-tight">{label}</span>
            </div>
            {isLoading ? (
              <>
                <div className="h-6 w-28 rounded bg-[var(--surface-high)] animate-pulse" />
                <div className="h-3 w-24 rounded bg-[var(--surface-high)] animate-pulse mt-2" />
              </>
            ) : (
              <>
                <p className="text-[16px] font-bold tabular-nums text-on-surface">{negativo ? '−' : ''}{formatCOP(valor)}</p>
                <p className="text-[11px] mt-1 truncate" style={{ color: deltaColor }}>{deltaTexto}</p>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
