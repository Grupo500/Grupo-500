'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate } from '@/lib/utils'
import { CalendarDays, MessageCircle, ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, Wallet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Cuota {
  id: string
  monto: number
  fechaVencimiento: string
  pagado: boolean
  numero: number
  financiamiento: {
    estudiante: {
      nombre: string
      acudiente?: { nombre: string; telefono: string } | null
    }
  }
}

type CalendarioData = Record<string, Cuota[]>
type FiltroEstado = 'porCobrar' | 'cobrado' | 'vencidas' | null

function esVencida(c: Cuota) {
  return !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
}

function diasVencido(fecha: string) {
  return Math.floor((Date.now() - parseISO(fecha).getTime()) / 86400000)
}

function generarMensajeWhatsApp(cuota: Cuota) {
  const acudiente = cuota.financiamiento.estudiante.acudiente
  const nombre = acudiente?.nombre ?? cuota.financiamiento.estudiante.nombre
  const telefono = acudiente?.telefono?.replace(/\D/g, '') ?? ''
  const monto = formatCOP(cuota.monto)
  const fecha = formatDate(cuota.fechaVencimiento)
  const estudiante = cuota.financiamiento.estudiante.nombre
  const msg = encodeURIComponent(
    `Hola ${nombre}, le recordamos que la cuota de *${estudiante}* por *${monto}* vence el *${fecha}*. Por favor realizar el pago a tiempo. Gracias — Grupo 500 🎓`
  )
  return telefono ? `https://wa.me/${telefono}?text=${msg}` : null
}

export default function CobrosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(new Date())
  const [filtro, setFiltro] = useState<FiltroEstado>(null)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const desde = startOfMonth(mesActual).toISOString().split('T')[0]
  const hasta = endOfMonth(mesActual).toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-calendario', desde, hasta],
    queryFn: () => fetcher<any>(`/cobros/calendario?desde=${desde}&hasta=${hasta}`),
  })

  const pagarCuotaMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/cuotas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pagado: true }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cobros-calendario'] }),
  })

  const calendarioData: CalendarioData = data?.data ?? {}

  const todasLasCuotas = Object.values(calendarioData).flat()

  const cuotasDelDia = diaSeleccionado
    ? Object.entries(calendarioData)
        .filter(([fecha]) => isSameDay(parseISO(fecha), diaSeleccionado))
        .flatMap(([, cuotas]) => cuotas)
    : []

  const cuotasFiltradas = !filtro ? cuotasDelDia
    : filtro === 'cobrado'   ? cuotasDelDia.filter(c => c.pagado)
    : filtro === 'vencidas'  ? cuotasDelDia.filter(c => esVencida(c))
    : cuotasDelDia.filter(c => !c.pagado && !esVencida(c))

  const diasDelMes = eachDayOfInterval({ start: startOfMonth(mesActual), end: endOfMonth(mesActual) })

  const cuotasEnDia = (dia: Date) =>
    Object.entries(calendarioData)
      .filter(([fecha]) => isSameDay(parseISO(fecha), dia))
      .flatMap(([, cuotas]) => cuotas)

  const totalPorCobrar = todasLasCuotas.filter(c => !c.pagado && !esVencida(c)).reduce((s, c) => s + c.monto, 0)
  const totalCobrado   = todasLasCuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const totalVencidas  = todasLasCuotas.filter(c => esVencida(c)).length

  const toggleFiltro = (f: FiltroEstado) => setFiltro(prev => prev === f ? null : f)
  const cardBase = 'card p-4 flex items-center gap-3 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent'

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Calendario de cobros" subtitle="Gestiona las cuotas y envía recordatorios por WhatsApp" />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Por cobrar */}
        <button onClick={() => toggleFiltro('porCobrar')} className={cn(
          'card p-3 flex flex-col items-center text-center gap-2 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent',
          filtro === 'porCobrar' ? 'ring-primary/40 bg-[var(--primary-container)]/50 border-primary/30' : 'hover:bg-[var(--surface-high)]'
        )}>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            filtro === 'porCobrar' ? 'bg-primary text-on-primary' : 'bg-[var(--primary-container)] text-primary')}>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="w-full min-w-0">
            <p className={cn('text-[10px] font-medium leading-none mb-1', filtro === 'porCobrar' ? 'text-primary' : 'text-on-surface-variant')}>Por cobrar</p>
            <p className="text-[13px] font-bold text-on-surface tabular leading-none">{formatCOP(totalPorCobrar)}</p>
          </div>
        </button>

        {/* Cobrado */}
        <button onClick={() => toggleFiltro('cobrado')} className={cn(
          'card p-3 flex flex-col items-center text-center gap-2 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent',
          filtro === 'cobrado' ? 'ring-secondary/40 bg-[var(--secondary-container)]/50 border-secondary/30' : 'hover:bg-[var(--surface-high)]'
        )}>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            filtro === 'cobrado' ? 'bg-secondary text-white' : 'bg-[var(--secondary-container)] text-secondary')}>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="w-full min-w-0">
            <p className={cn('text-[10px] font-medium leading-none mb-1', filtro === 'cobrado' ? 'text-secondary' : 'text-on-surface-variant')}>Cobrado</p>
            <p className="text-[13px] font-bold text-on-surface tabular leading-none">{formatCOP(totalCobrado)}</p>
          </div>
        </button>

        {/* Vencidas */}
        <button onClick={() => toggleFiltro('vencidas')} className={cn(
          'card p-3 flex flex-col items-center text-center gap-2 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent',
          filtro === 'vencidas' ? 'ring-[var(--error)]/40 bg-[var(--error-container)]/50 border-[var(--error)]/30' : 'hover:bg-[var(--surface-high)]'
        )}>
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            filtro === 'vencidas' ? 'bg-[var(--error)] text-white' : 'bg-[var(--error-container)] text-[var(--error)]')}>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="w-full min-w-0">
            <p className={cn('text-[10px] font-medium leading-none mb-1', filtro === 'vencidas' ? 'text-[var(--error)]' : 'text-on-surface-variant')}>Vencidas</p>
            <p className="text-[13px] font-bold text-[var(--error)] tabular leading-none">{totalVencidas}</p>
          </div>
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
              <button onClick={() => setMesActual(subMonths(mesActual, 1))} className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setMesActual(new Date())} className="btn-ghost text-xs px-3 py-2">Hoy</button>
              <button onClick={() => setMesActual(addMonths(mesActual, 1))} className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <>
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
                  const cuotas     = cuotasEnDia(dia)
                  const pendientes = cuotas.filter(c => !c.pagado)
                  const vencidas   = cuotas.filter(c => esVencida(c))
                  const isSelected = isSameDay(dia, diaSeleccionado)
                  const esHoy      = isToday(dia)

                  return (
                    <button key={dia.toISOString()} onClick={() => setDiaSeleccionado(dia)}
                      className={cn(
                        'relative flex flex-col items-center py-2 px-1 rounded-lg transition-all duration-150 min-h-[52px]',
                        isSelected ? 'bg-[var(--primary-container)] border border-primary/30 text-primary'
                          : esHoy ? 'border border-secondary/40 text-secondary'
                          : 'hover:bg-[var(--surface-high)] text-on-surface-variant hover:text-on-surface',
                      )}>
                      <span className={cn('text-[13px] font-medium', esHoy && 'font-bold')}>{format(dia, 'd')}</span>
                      {cuotas.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {pendientes.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />}
                          {vencidas.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />}
                          {cuotas.some(c => c.pagado) && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
                        </div>
                      )}
                      {cuotas.length > 1 && (
                        <span className="absolute top-1 right-1 text-[9px] font-bold text-tertiary">{cuotas.length}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-[var(--outline-variant)]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tertiary" /><span className="text-[11px] text-on-surface-variant">Pendiente</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" /><span className="text-[11px] text-on-surface-variant">Pagado</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--error)]" /><span className="text-[11px] text-on-surface-variant">Vencido</span></div>
              </div>
            </>
          )}
        </div>

        {/* Panel lateral */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-[14px] font-semibold text-on-surface">
                {format(diaSeleccionado, "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            {filtro && (
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                filtro === 'porCobrar' ? 'bg-[var(--primary-container)] text-primary'
                  : filtro === 'cobrado' ? 'bg-[var(--secondary-container)] text-secondary'
                  : 'bg-[var(--error-container)] text-[var(--error)]',
              )}>
                {filtro === 'porCobrar' ? 'Por cobrar' : filtro === 'cobrado' ? 'Cobrado' : 'Vencidas'}
              </span>
            )}
          </div>

          {cuotasFiltradas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <CalendarDays className="w-10 h-10 text-[var(--outline-variant)] mb-3" />
              <p className="text-[13px] text-on-surface-variant">
                {cuotasDelDia.length > 0 && filtro ? 'Sin cuotas con este filtro' : 'Sin cobros para este día'}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {cuotasFiltradas.map(cuota => {
                const vencido = esVencida(cuota)
                const dias    = vencido ? diasVencido(cuota.fechaVencimiento) : 0
                const waLink  = generarMensajeWhatsApp(cuota)

                return (
                  <div key={cuota.id} className={cn(
                    'rounded-xl p-3 border transition-colors',
                    cuota.pagado ? 'bg-[var(--secondary-container)]/30 border-[var(--outline-variant)]'
                      : vencido ? 'bg-[var(--error-container)]/40 border-[var(--error)]/20'
                      : 'bg-[var(--surface-high)] border-[var(--outline-variant)]',
                  )}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{cuota.financiamiento.estudiante.nombre}</p>
                        {cuota.financiamiento.estudiante.acudiente && (
                          <p className="text-[11px] text-on-surface-variant">{cuota.financiamiento.estudiante.acudiente.nombre}</p>
                        )}
                        <p className="text-[10px] text-on-surface-variant/60">Cuota #{cuota.numero}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {cuota.pagado && <span className="chip-success text-[10px]"><CheckCircle className="w-3 h-3" />Pagado</span>}
                        {vencido && <span className="chip-error text-[10px]"><AlertCircle className="w-3 h-3" />Vencido {dias}d</span>}
                        {!cuota.pagado && !vencido && <Clock className="w-4 h-4 text-tertiary" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[14px] font-bold text-on-surface tabular">{formatCOP(cuota.monto)}</span>
                      <div className="flex items-center gap-1.5">
                        {!cuota.pagado && (
                          <button
                            onClick={() => pagarCuotaMutation.mutate(cuota.id)}
                            disabled={pagarCuotaMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors disabled:opacity-40"
                          >
                            <CheckCircle className="w-3 h-3" />Pagar
                          </button>
                        )}
                        {!cuota.pagado && waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors">
                            <MessageCircle className="w-3 h-3" />WA
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {cuotasFiltradas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-on-surface-variant font-medium">Total pendiente del día</span>
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
