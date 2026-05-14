import { apiFetch } from '@/lib/api.server'
import { formatCOP, formatRelative } from '@/lib/utils'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CuotaProxima {
  id: string
  monto: number
  fechaVencimiento: string
  financiamiento: {
    estudiante: {
      nombre: string
      acudiente?: { nombre: string } | null
    }
  }
}

async function getCobrosProximos(): Promise<CuotaProxima[]> {
  try {
    const res = await apiFetch<{ data: CuotaProxima[] }>('/cobros/proximos?dias=7')
    return res?.data ?? []
  } catch {
    return []
  }
}

export async function ProximosCobros() {
  const cobros = await getCobrosProximos()
  const total = cobros.reduce((s, c) => s + c.monto, 0)

  return (
    <div className="card p-5 flex flex-col h-72">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--tertiary-container)] flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-3.5 h-3.5 text-tertiary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Próximos cobros</h3>
        </div>
        <span className="text-[11px] text-on-surface-variant font-medium">7 días</span>
      </div>

      {/* Lista */}
      <div className="flex-1 space-y-1 overflow-y-auto -mx-1 px-1">
        {cobros.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[13px] text-on-surface-variant">
            Sin cobros en los próximos 7 días
          </div>
        ) : (
          cobros.slice(0, 6).map((c) => {
            const nombre = c.financiamiento.estudiante.nombre
            const isUrgent = new Date(c.fechaVencimiento).getTime() - Date.now() < 2 * 86400000
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors',
                  'hover:bg-[var(--surface-high)] group cursor-pointer',
                  isUrgent && 'bg-[var(--tertiary-container)]/30',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    'w-1.5 h-6 rounded-full flex-shrink-0',
                    isUrgent ? 'bg-tertiary' : 'bg-[var(--outline-variant)]',
                  )} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-on-surface truncate">{nombre}</p>
                    <p className={cn('text-[11px] font-medium', isUrgent ? 'text-tertiary' : 'text-on-surface-variant')}>
                      {formatRelative(c.fechaVencimiento)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <span className="text-[13px] font-bold text-on-surface tabular">{formatCOP(c.monto)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-[var(--outline-variant)] flex items-center justify-between">
        <span className="text-[12px] text-on-surface-variant font-medium">Total próximos 7 días</span>
        <span className="text-[13px] font-bold text-on-surface tabular">
          {formatCOP(total)}
        </span>
      </div>
    </div>
  )
}
