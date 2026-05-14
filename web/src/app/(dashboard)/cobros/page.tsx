'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate } from '@/lib/utils'
import { CalendarDays, MessageCircle, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'

type FiltroEstado = 'porCobrar' | 'cobrado' | 'vencidas' | null

const cuotasMock = [
  { id: '1', estudianteNombre: 'Juan Pérez',    acudienteNombre: 'Rosa Pérez',   telefono: '+573001234567', monto: 250000, fechaVencimiento: new Date(2026, 4, 17), pagado: false },
  { id: '2', estudianteNombre: 'María García',  acudienteNombre: 'Pedro García', telefono: '+573009876543', monto: 180000, fechaVencimiento: new Date(2026, 4, 17), pagado: false },
  { id: '3', estudianteNombre: 'Carlos López',  acudienteNombre: 'Ana López',    telefono: '+573001112222', monto: 320000, fechaVencimiento: new Date(2026, 4, 20), pagado: false },
  { id: '4', estudianteNombre: 'Sofía Martínez',acudienteNombre: 'Luis Martínez',telefono: '+573003334444', monto: 150000, fechaVencimiento: new Date(2026, 4, 22), pagado: true  },
  { id: '5', estudianteNombre: 'Andrés Ruiz',   acudienteNombre: 'Clara Ruiz',   telefono: '+573005556666', monto: 280000, fechaVencimiento: new Date(2026, 4, 10), pagado: false },
]

function esVencida(c: typeof cuotasMock[0]) {
  return !c.pagado && isBefore(c.fechaVencimiento, new Date()) && !isToday(c.fechaVencimiento)
}

function diasVencido(fecha: Date) {
  return Math.floor((Date.now() - fecha.getTime()) / 86400000)
}

function generarMensajeWhatsApp(cuota: typeof cuotasMock[0]) {
  const monto = formatCOP(cuota.monto)
  const fecha = formatDate(cuota.fechaVencimiento)
  const msg = encodeURIComponent(
    `Hola ${cuota.acudienteNombre}, le recordamos que la cuota de *${cuota.estudianteNombre}* por *${monto}* vence el *${fecha}*. Por favor realizar el pago a tiempo. Gracias — Grupo 500 🎓`
  )
  return `https://wa.me/${cuota.telefono.replace(/\D/g, '')}?text=${msg}`
}

function aplicarFiltro(cuotas: typeof cuotasMock, filtro: FiltroEstado) {
  if (!filtro) return cuotas
  if (filtro === 'cobrado')   return cuotas.filter(c => c.pagado)
  if (filtro === 'vencidas')  return cuotas.filter(c => esVencida(c))
  if (filtro === 'porCobrar') return cuotas.filter(c => !c.pagado && !esVencida(c))
  return cuotas
}

export default function CobrosPage() {
  const [mesActual, setMesActual]           = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(new Date())
  const [filtro, setFiltro]                 = useState<FiltroEstado>(null)

  const toggleFiltro = (f: FiltroEstado) => setFiltro(prev => prev === f ? null : f)

  const diasDelMes     = eachDayOfInterval({ start: startOfMonth(mesActual), end: endOfMonth(mesActual) })
  const cuotasDelDia   = diaSeleccionado ? cuotasMock.filter(c => isSameDay(c.fechaVencimiento, diaSeleccionado)) : []
  const cuotasFiltradas = aplicarFiltro(cuotasDelDia, filtro)
  const cuotasDelMes   = (dia: Date) => cuotasMock.filter(c => isSameDay(c.fechaVencimiento, dia))

  // Resumen del mes
  const totalPorCobrar = cuotasMock.filter(c => !c.pagado && !esVencida(c)).reduce((s, c) => s + c.monto, 0)
  const totalCobrado   = cuotasMock.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const totalVencidas  = cuotasMock.filter(c => esVencida(c)).length

  const cardBase  = 'card p-4 flex items-center gap-3 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent'
  const cardActive = (f: FiltroEstado, color: string) =>
    filtro === f ? `ring-${color}/50 bg-${color}/5` : 'hover:bg-[var(--surface-high)]'

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Calendarios"
        subtitle="Gestiona las cuotas y envía recordatorios por WhatsApp"
      />

      {/* Tarjetas resumen — seleccionables como filtro */}
      <div className="grid grid-cols-3 gap-3">
        {/* Por cobrar */}
        <button
          onClick={() => toggleFiltro('porCobrar')}
          className={cn(cardBase, filtro === 'porCobrar'
            ? 'ring-primary/40 bg-[var(--primary-container)]/50 border-primary/30'
            : 'hover:bg-[var(--surface-high)]'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
            filtro === 'porCobrar' ? 'bg-primary text-on-primary' : 'bg-[var(--primary-container)] text-primary',
          )}>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className={cn('text-[11px] font-medium', filtro === 'porCobrar' ? 'text-primary' : 'text-on-surface-variant')}>Por cobrar</p>
            <p className="text-[16px] font-bold text-on-surface tabular">{formatCOP(totalPorCobrar)}</p>
          </div>
          {filtro === 'porCobrar' && (
            <span className="ml-auto text-[10px] font-bold text-primary bg-[var(--primary-container)] px-1.5 py-0.5 rounded-full">Activo</span>
          )}
        </button>

        {/* Cobrado */}
        <button
          onClick={() => toggleFiltro('cobrado')}
          className={cn(cardBase, filtro === 'cobrado'
            ? 'ring-secondary/40 bg-[var(--secondary-container)]/50 border-secondary/30'
            : 'hover:bg-[var(--surface-high)]'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
            filtro === 'cobrado' ? 'bg-secondary text-on-secondary' : 'bg-[var(--secondary-container)] text-secondary',
          )}>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className={cn('text-[11px] font-medium', filtro === 'cobrado' ? 'text-secondary' : 'text-on-surface-variant')}>Cobrado</p>
            <p className="text-[16px] font-bold text-on-surface tabular">{formatCOP(totalCobrado)}</p>
          </div>
          {filtro === 'cobrado' && (
            <span className="ml-auto text-[10px] font-bold text-secondary bg-[var(--secondary-container)] px-1.5 py-0.5 rounded-full">Activo</span>
          )}
        </button>

        {/* Vencidas */}
        <button
          onClick={() => toggleFiltro('vencidas')}
          className={cn(cardBase, filtro === 'vencidas'
            ? 'ring-[var(--error)]/40 bg-[var(--error-container)]/50 border-[var(--error)]/30'
            : 'hover:bg-[var(--surface-high)]'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
            filtro === 'vencidas' ? 'bg-[var(--error)] text-white' : 'bg-[var(--error-container)] text-[var(--error)]',
          )}>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className={cn('text-[11px] font-medium', filtro === 'vencidas' ? 'text-[var(--error)]' : 'text-on-surface-variant')}>Vencidas</p>
            <p className="text-[16px] font-bold text-[var(--error)] tabular">{totalVencidas}</p>
          </div>
          {filtro === 'vencidas' && (
            <span className="ml-auto text-[10px] font-bold text-[var(--error)] bg-[var(--error-container)] px-1.5 py-0.5 rounded-full">Activo</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendario */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-on-surface capitalize">
              {format(mesActual, 'MMMM yyyy', { locale: es })}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setMesActual(subMonths(mesActual, 1))} className="btn-ghost p-2">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setMesActual(new Date())} className="btn-ghost text-xs px-3 py-2">
                Hoy
              </button>
              <button onClick={() => setMesActual(addMonths(mesActual, 1))} className="btn-ghost p-2">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (startOfMonth(mesActual).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {diasDelMes.map(dia => {
              const cuotas     = cuotasDelMes(dia)
              const pendientes = cuotas.filter(c => !c.pagado)
              const isSelected = diaSeleccionado && isSameDay(dia, diaSeleccionado)
              const esHoy      = isToday(dia)

              return (
                <button
                  key={dia.toISOString()}
                  onClick={() => setDiaSeleccionado(dia)}
                  className={cn(
                    'relative flex flex-col items-center py-2 px-1 rounded-lg transition-all duration-150 min-h-[52px]',
                    isSelected
                      ? 'bg-[var(--primary-container)] border border-primary/30 text-primary'
                      : esHoy
                        ? 'border border-secondary/40 text-secondary'
                        : 'hover:bg-[var(--surface-high)] text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  <span className={cn('text-[13px] font-medium', esHoy && 'font-bold')}>
                    {format(dia, 'd')}
                  </span>
                  {cuotas.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {pendientes.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />}
                      {cuotas.some(c => c.pagado) && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
                    </div>
                  )}
                  {pendientes.length > 1 && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold text-tertiary">
                      {pendientes.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-5 mt-4 pt-4 border-t border-[var(--outline-variant)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span className="text-[11px] text-on-surface-variant">Pendiente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-[11px] text-on-surface-variant">Pagado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
              <span className="text-[11px] text-on-surface-variant">Vencido</span>
            </div>
          </div>
        </div>

        {/* Panel lateral — cuotas del día filtradas */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-[14px] font-semibold text-on-surface">
                {diaSeleccionado
                  ? format(diaSeleccionado, "d 'de' MMMM", { locale: es })
                  : 'Selecciona un día'}
              </h3>
            </div>
            {filtro && (
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                filtro === 'porCobrar' ? 'bg-[var(--primary-container)] text-primary' :
                filtro === 'cobrado'   ? 'bg-[var(--secondary-container)] text-secondary' :
                                        'bg-[var(--error-container)] text-[var(--error)]',
              )}>
                {filtro === 'porCobrar' ? 'Por cobrar' : filtro === 'cobrado' ? 'Cobrado' : 'Vencidas'}
              </span>
            )}
          </div>

          {cuotasFiltradas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <CalendarDays className="w-10 h-10 text-[var(--outline-variant)] mb-3" />
              <p className="text-[13px] text-on-surface-variant">
                {cuotasDelDia.length > 0 && filtro
                  ? 'Sin cuotas con este estado para el día'
                  : 'Sin cobros para este día'}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {cuotasFiltradas.map(cuota => {
                const vencido = esVencida(cuota)
                const dias    = vencido ? diasVencido(cuota.fechaVencimiento) : 0

                return (
                  <div key={cuota.id} className={cn(
                    'rounded-xl p-3 border transition-colors',
                    cuota.pagado
                      ? 'bg-[var(--secondary-container)]/30 border-[var(--outline-variant)]'
                      : vencido
                        ? 'bg-[var(--error-container)]/40 border-[var(--error)]/20'
                        : 'bg-[var(--surface-high)] border-[var(--outline-variant)]',
                  )}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface">{cuota.estudianteNombre}</p>
                        <p className="text-[11px] text-on-surface-variant">{cuota.acudienteNombre}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {cuota.pagado && (
                          <span className="chip-success text-[10px]">
                            <CheckCircle className="w-3 h-3" />Pagado
                          </span>
                        )}
                        {vencido && (
                          <span className="chip-error text-[10px]">
                            <AlertCircle className="w-3 h-3" />Vencido {dias}d
                          </span>
                        )}
                        {!cuota.pagado && !vencido && (
                          <Clock className="w-4 h-4 text-tertiary" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-on-surface tabular">
                        {formatCOP(cuota.monto)}
                      </span>
                      {!cuota.pagado && (
                        <a
                          href={generarMensajeWhatsApp(cuota)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                                     bg-secondary/10 text-secondary border border-secondary/20
                                     hover:bg-secondary/20 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {cuotasFiltradas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-on-surface-variant font-medium">
                  {filtro ? 'Total filtrado' : 'Total del día'}
                </span>
                <span className="text-[14px] font-bold text-on-surface tabular">
                  {formatCOP(cuotasFiltradas.filter(c => !c.pagado).reduce((s, c) => s + c.monto, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
