'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, cn } from '@/lib/utils'
import {
  CalendarDays, MessageCircle, ChevronLeft, ChevronRight,
  Clock, CheckCircle, AlertCircle, Loader2, Phone, User,
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday, isBefore, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
interface EventoCalendario {
  tipo: 'cuota' | 'pago'
  id: string
  monto: number
  estado: string
  estudiante: {
    id: string
    nombre: string
    telefono: string
    acudiente?: { nombre: string; telefono: string } | null
    asesor?: { nombre: string } | null
  }
  numero?: number
  financiamientoId?: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function esVencido(estado: string) {
  return estado === 'VENCIDO'
}

function generarMensajeWA(ev: EventoCalendario) {
  const ac = ev.estudiante.acudiente
  const nombre = ac?.nombre ?? ev.estudiante.nombre
  const telefono = (ac?.telefono ?? ev.estudiante.telefono ?? '').replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Hola ${nombre}, le recordamos que ${ev.tipo === 'cuota' ? `la cuota #${ev.numero}` : 'el pago'} de *${ev.estudiante.nombre}* por *${formatCOP(ev.monto)}* con Grupo 500 está pendiente. Por favor realizar el pago a tiempo. Gracias — Grupo 500 🎓`
  )
  return telefono ? `https://wa.me/57${telefono}?text=${msg}` : null
}

/* ─── Página ─────────────────────────────────────────────────────────────── */
export default function CalendarioPage() {
  const queryClient = useQueryClient()
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(new Date())

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const desde = format(startOfMonth(mesActual), 'yyyy-MM-dd')
  const hasta  = format(endOfMonth(mesActual),   'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-calendario', desde, hasta],
    queryFn: () => fetcher<{ data: Record<string, EventoCalendario[]> }>(`/cobros/calendario?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  const calendarioData: Record<string, EventoCalendario[]> = data?.data ?? {}

  const diasDelMes = eachDayOfInterval({ start: startOfMonth(mesActual), end: endOfMonth(mesActual) })

  const eventosEnDia = (dia: Date): EventoCalendario[] => {
    const key = format(dia, 'yyyy-MM-dd')
    return calendarioData[key] ?? []
  }

  const eventosDelDia = eventosEnDia(diaSeleccionado)

  const totalDelMes  = Object.values(calendarioData).reduce((s, arr) => s + arr.length, 0)
  const montoDelMes  = Object.values(calendarioData).flat().reduce((s, e) => s + e.monto, 0)

  // Padding ISO → Lunes primero (0=Lun … 6=Dom)
  const offsetInicio = (startOfMonth(mesActual).getDay() + 6) % 7

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Calendario" subtitle="Visualiza y gestiona cobros por fecha" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-lowest border border-outline-variant rounded-xl p-3">
          <p className="text-[11px] text-on-surface-variant capitalize">
            Cobros en {format(mesActual, 'MMMM', { locale: es })}
          </p>
          <p className="text-xl font-bold text-on-surface tabular-nums mt-0.5">{totalDelMes}</p>
        </div>
        <div className="bg-surface-lowest border border-outline-variant rounded-xl p-3">
          <p className="text-[11px] text-on-surface-variant">Monto pendiente del mes</p>
          <p className="text-xl font-bold text-primary tabular-nums mt-0.5">{formatCOP(montoDelMes)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendario */}
        <div className="lg:col-span-2 bg-surface-lowest border border-outline-variant rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-on-surface capitalize">
              {format(mesActual, 'MMMM yyyy', { locale: es })}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => { setMesActual(subMonths(mesActual, 1)); setDiaSeleccionado(startOfMonth(subMonths(mesActual, 1))) }}
                className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { setMesActual(new Date()); setDiaSeleccionado(new Date()) }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                Hoy
              </button>
              <button onClick={() => { setMesActual(addMonths(mesActual, 1)); setDiaSeleccionado(startOfMonth(addMonths(mesActual, 1))) }}
                className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Encabezados días */}
          <div className="grid grid-cols-7 mb-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-on-surface-variant py-1">{d}</div>
            ))}
          </div>

          {/* Grid días */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: offsetInicio }).map((_, i) => <div key={`pad-${i}`} />)}
                {diasDelMes.map(dia => {
                  const evs       = eventosEnDia(dia)
                  const isSelected = isSameDay(dia, diaSeleccionado)
                  const esHoy     = isToday(dia)
                  const tieneVencidos   = evs.some(e => e.estado === 'VENCIDO')
                  const tienePendientes = evs.length > 0

                  return (
                    <button
                      key={format(dia, 'yyyy-MM-dd')}
                      onClick={() => setDiaSeleccionado(dia)}
                      className={cn(
                        'relative flex flex-col items-center justify-start pt-1.5 pb-2 rounded-xl min-h-[52px] transition-all duration-150 cursor-pointer',
                        isSelected
                          ? 'bg-primary text-on-primary shadow-sm'
                          : esHoy
                            ? 'bg-primary/10 border border-primary/30 text-primary'
                            : tienePendientes
                              ? 'hover:bg-surface-high bg-surface-high/50'
                              : 'hover:bg-surface-high/50 text-on-surface-variant',
                      )}
                    >
                      <span className={cn(
                        'text-xs font-semibold leading-none',
                        isSelected ? 'text-on-primary' : esHoy ? 'text-primary' : tienePendientes ? 'text-on-surface' : 'text-on-surface-variant'
                      )}>
                        {format(dia, 'd')}
                      </span>
                      {tienePendientes && (
                        <div className="flex flex-col items-center gap-0.5 mt-1 w-full px-1">
                          <div className={cn('w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-on-primary/70' : tieneVencidos ? 'bg-[#dc2626]' : 'bg-primary')} />
                          {evs.length > 1 && (
                            <span className={cn('text-[8px] font-bold leading-none',
                              isSelected ? 'text-on-primary/80' : tieneVencidos ? 'text-[#dc2626]' : 'text-primary')}>
                              {evs.length}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-outline-variant/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] text-on-surface-variant">Pendiente</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#dc2626]" />
                  <span className="text-[10px] text-on-surface-variant">Vencido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary/30 border border-primary" />
                  <span className="text-[10px] text-on-surface-variant">Hoy</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Panel lateral del día */}
        <div className="bg-surface-lowest border border-outline-variant rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="text-[14px] font-semibold text-on-surface capitalize">
              {format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
          </div>

          {eventosDelDia.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-on-surface-variant">
              <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-[13px]">Sin cobros para este día</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-on-surface-variant mb-3">
                {eventosDelDia.length} cobro{eventosDelDia.length !== 1 ? 's' : ''} · {formatCOP(eventosDelDia.reduce((s, e) => s + e.monto, 0))}
              </p>
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {eventosDelDia.map(ev => {
                  const vencido = esVencido(ev.estado)
                  const waLink  = generarMensajeWA(ev)
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        'rounded-xl p-3 border',
                        vencido
                          ? 'bg-[#dc2626]/4 border-[#dc2626]/25'
                          : 'bg-surface-high/50 border-outline-variant/60',
                      )}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                              ev.tipo === 'cuota' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                            )}>
                              {ev.tipo === 'cuota' ? `Cuota #${ev.numero}` : 'Pago único'}
                            </span>
                            {vencido && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#dc2626]/10 text-[#dc2626] flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" />Vencido
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] font-semibold text-on-surface truncate">{ev.estudiante.nombre}</p>
                          {ev.estudiante.acudiente && (
                            <p className="text-[10px] text-on-surface-variant">{ev.estudiante.acudiente.nombre}</p>
                          )}
                          {ev.estudiante.asesor && (
                            <p className="text-[10px] text-on-surface-variant/70">Asesor: {ev.estudiante.asesor.nombre}</p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-on-surface tabular-nums flex-shrink-0 ml-2">{formatCOP(ev.monto)}</p>
                      </div>

                      {/* Contacto */}
                      <div className="space-y-1 mb-2">
                        {ev.estudiante.telefono && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                            <a href={`https://wa.me/57${ev.estudiante.telefono.replace(/\D/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline">
                              {ev.estudiante.telefono}
                            </a>
                          </div>
                        )}
                        {ev.estudiante.acudiente?.telefono && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                            <a href={`https://wa.me/57${ev.estudiante.acudiente.telefono.replace(/\D/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline">
                              {ev.estudiante.acudiente.telefono}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Botones */}
                      <div className="flex gap-1.5">
                        {!vencido && (
                          <span className="flex items-center gap-1 text-[10px] text-[#16a34a] font-medium">
                            <Clock className="w-3 h-3" />Pendiente
                          </span>
                        )}
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#25D366]/10 text-[#16a34a] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors">
                            <MessageCircle className="w-3 h-3" />Recordatorio
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-outline-variant/40">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-on-surface-variant font-medium">Total pendiente</span>
                  <span className="text-[14px] font-bold text-on-surface tabular-nums">
                    {formatCOP(eventosDelDia.reduce((s, e) => s + e.monto, 0))}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
