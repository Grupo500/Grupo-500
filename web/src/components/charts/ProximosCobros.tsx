import { formatCOP, formatRelative } from '@/lib/utils'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

// Placeholder — conectar al API
const cobros = [
  { nombre: 'Juan Pérez', monto: 250000, fecha: new Date(Date.now() + 1 * 86400000).toISOString() },
  { nombre: 'María García', monto: 180000, fecha: new Date(Date.now() + 2 * 86400000).toISOString() },
  { nombre: 'Carlos López', monto: 320000, fecha: new Date(Date.now() + 3 * 86400000).toISOString() },
  { nombre: 'Ana Martínez', monto: 150000, fecha: new Date(Date.now() + 5 * 86400000).toISOString() },
]

export function ProximosCobros() {
  return (
    <div className="card p-5 h-72 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-tertiary" />
        <h3 className="text-title-lg font-medium text-on-surface">Próximos cobros</h3>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {cobros.map((c, i) => {
          const isUrgent = new Date(c.fecha).getTime() - Date.now() < 2 * 86400000
          return (
            <div key={i} className={cn(
              'flex items-center justify-between p-3 rounded-md',
              'bg-surface-high border border-white/[0.05]',
              'hover:border-white/10 transition-colors',
            )}>
              <div className="min-w-0">
                <p className="text-body-md font-medium text-on-surface truncate">{c.nombre}</p>
                <p className={cn('text-label-md', isUrgent ? 'text-tertiary' : 'text-on-surface-variant')}>
                  {formatRelative(c.fecha)}
                </p>
              </div>
              <p className="text-sm font-bold text-on-surface tabular ml-3 flex-shrink-0">
                {formatCOP(c.monto)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
