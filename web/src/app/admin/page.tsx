'use client'

// Resumen general del área de Administración.
//
// Es la única pieza nueva del panel: hasta ahora, para saber cómo iba el mes
// había que entrar a Ventas, a Marketing y a Finanzas por separado. Las cifras
// vienen de un solo endpoint y no de tres llamadas, para que salgan de la misma
// foto — consultadas por aparte, dos peticiones a distinto segundo pueden
// mostrar totales que no cuadran entre sí.

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCOP, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'

interface Resumen {
  periodo: { desde: string; hasta: string }
  ventas: { facturado: number; neto: number; comisiones: number; cantidad: number; asesores: number; sinAsesor: number }
  cartera: { vencido: number; cuotas: number }
  marketing: {
    planificado: number; enProceso: number; publicado: number; equipo: number
    cobros: { porAprobar: number; aprobado: number; pagado: number }
  }
}

function Cifra({ label, valor, detalle, tono }: {
  label: string; valor: string; detalle?: string; tono?: 'ok' | 'alerta'
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <p className={cn(
        'mt-1 text-[22px] font-bold tracking-[-0.022em] tabular-nums',
        tono === 'ok' ? 'text-[#0f7a35]' : tono === 'alerta' ? 'text-[#9a5b06]' : 'text-on-surface',
      )}>
        {valor}
      </p>
      {detalle && <p className="mt-0.5 text-[10.5px] text-on-surface-variant">{detalle}</p>}
    </div>
  )
}

/** Bloque por área, con su color y un enlace a donde se trabaja de verdad. */
function Area({ titulo, color, href, filas }: {
  titulo: string; color: string; href: string; filas: { l: string; v: string }[]
}) {
  return (
    <div className="card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {titulo}
        </p>
        <Link href={href} className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
          Ir <ChevronRight className="size-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {filas.map(f => (
          <div key={f.l} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-on-surface-variant">{f.l}</span>
            <span className="font-semibold tabular-nums text-on-surface">{f.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminResumenPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['resumen-general'],
    queryFn: () => apiFetch<{ data: Resumen }>('/reportes/resumen-general'),
  })
  const r = data?.data
  const mes = r ? format(new Date(r.periodo.desde), "MMMM 'de' yyyy", { locale: es }) : ''

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-on-surface-variant">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Resumen general"
        subtitle={mes ? `${mes.charAt(0).toUpperCase()}${mes.slice(1)} · las áreas en una sola pantalla` : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra label="Facturado" valor={formatCOP(r?.ventas.facturado ?? 0)}
               detalle={`${r?.ventas.cantidad ?? 0} ventas en el mes`} />
        <Cifra label="Neto recibido" valor={formatCOP(r?.ventas.neto ?? 0)} tono="ok"
               detalle={`después de ${formatCOP(r?.ventas.comisiones ?? 0)} en comisiones`} />
        <Cifra label="Vencido por cobrar" valor={formatCOP(r?.cartera.vencido ?? 0)} tono="alerta"
               detalle={`${r?.cartera.cuotas ?? 0} cuotas atrasadas en Hotmart`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Area
          titulo="Ventas" color="#2094ff" href="/admin/ventas"
          filas={[
            { l: 'Asesores activos',        v: String(r?.ventas.asesores ?? 0) },
            { l: 'Ventas del mes',          v: String(r?.ventas.cantidad ?? 0) },
            // Se muestra aunque incomode: son ventas que nadie tiene acreditadas.
            { l: 'Pagos sin asesor',        v: String(r?.ventas.sinAsesor ?? 0) },
          ]}
        />
        <Area
          titulo="Marketing" color="#7c3aed" href="/marketing"
          filas={[
            { l: 'Publicado este mes',      v: String(r?.marketing.publicado ?? 0) },
            { l: 'En proceso',              v: String(r?.marketing.enProceso ?? 0) },
            { l: 'Cobros por aprobar',      v: formatCOP(r?.marketing.cobros.porAprobar ?? 0) },
            { l: 'Equipo',                  v: String(r?.marketing.equipo ?? 0) },
          ]}
        />
      </div>
    </div>
  )
}
