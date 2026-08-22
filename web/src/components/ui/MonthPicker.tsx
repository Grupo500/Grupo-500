'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay,
  isWithinInterval, isAfter,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export interface DateRange { start: Date; end: Date }

/**
 * La semana en curso, de domingo a sábado — la misma semana del ciclo de
 * cobros (Hotman, 22-ago). Es el período por defecto de Entregables.
 */
export function semanaActual(hoy: Date = new Date()): DateRange {
  const start = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - hoy.getDay())
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return { start, end }
}

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

interface Props {
  value: string | null           // 'YYYY-MM' del mes seleccionado
  currentMonth: string           // 'YYYY-MM' del mes actual
  dateRange: DateRange | null
  onChange: (month: string | null, range: DateRange | null) => void
  alignRight?: boolean
  iconOnly?: boolean
  /**
   * Lo pinta como el alcance de la pantalla y no como un filtro más: relleno
   * suave y sin borde, para que se lea antes que el resto de la fila
   * (Hotman, 20-ago).
   */
  comoPeriodo?: boolean
}

function buildDays(base: Date): Date[] {
  const start = startOfWeek(startOfMonth(base), { weekStartsOn: 1 })
  const end   = endOfWeek(endOfMonth(base),     { weekStartsOn: 1 })
  const days: Date[] = []
  let d = start
  while (!isAfter(d, end)) { days.push(d); d = addDays(d, 1) }
  return days
}

export function MonthPicker({ value, currentMonth, dateRange, onChange, alignRight = false, iconOnly = false, comoPeriodo = false }: Props) {
  const [open,     setOpen]     = useState(false)
  const [step,     setStep]     = useState<'month' | 'days'>('month')
  const [viewYear, setViewYear] = useState(() => {
    const m = value ?? currentMonth
    return m ? parseInt(m.split('-')[0]) : new Date().getFullYear()
  })
  const [calBase,    setCalBase]    = useState<Date | null>(null)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd,   setRangeEnd]   = useState<Date | null>(null)
  const [hoverDay,   setHoverDay]   = useState<Date | null>(null)
  const ref    = useRef<HTMLDivElement>(null)   // contenedor del trigger (medición + clic fuera)
  const popRef = useRef<HTMLDivElement>(null)   // panel flotante (portal)

  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => setMounted(true), [])

  // Cerrar al clic fuera (considera trigger Y panel, porque el panel vive en un portal)
  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      setOpen(false)
      setStep('month')
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Posicionar el panel pegado al trigger, ajustado para no salirse de la pantalla
  useLayoutEffect(() => {
    if (!open) return
    function compute() {
      const el = ref.current
      if (!el) return
      const r      = el.getBoundingClientRect()
      const margin = 12
      const width  = Math.min(288, window.innerWidth - margin * 2)
      let left     = alignRight ? r.right - width : r.left
      // Clamp horizontal: nunca fuera de la pantalla
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
      setPos({ top: r.bottom + 8, left, width })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, alignRight])

  // Sincronizar rango externo
  useEffect(() => {
    if (dateRange) { setRangeStart(dateRange.start); setRangeEnd(dateRange.end) }
    else           { setRangeStart(null); setRangeEnd(null) }
  }, [dateRange])

  const selected = value ?? currentMonth

  function handleSelectYear() {
    const start = new Date(viewYear, 0, 1)
    const end   = new Date(viewYear, 11, 31)
    setRangeStart(start); setRangeEnd(end)
    onChange(null, { start, end })
    setOpen(false); setStep('month')
  }

  function handleSelectMonth(monthKey: string) {
    const [y, m] = monthKey.split('-').map(Number)
    setCalBase(new Date(y, m - 1, 1))
    onChange(monthKey === currentMonth ? null : monthKey, null)
    setRangeStart(null); setRangeEnd(null)
    // Elegir un mes cierra. Antes abría solo el calendario de días encima, y
    // es lo que menos se usa: había que cerrarlo a mano cada vez.
    setOpen(false)
  }

  /** Los períodos que se piden casi siempre, sin navegar el calendario. */
  function atajo(cual: 'semana' | 'mes' | 'anterior' | 'anio') {
    if (cual === 'semana') {
      const semana = semanaActual()
      setRangeStart(semana.start); setRangeEnd(semana.end)
      onChange(null, semana)
      setOpen(false)
      return
    }
    if (cual === 'mes') { onChange(null, null); setOpen(false); return }
    if (cual === 'anio') { handleSelectYear(); return }
    const [y, m] = currentMonth.split('-').map(Number)
    const previo = new Date(y, m - 2, 1)
    const clave = `${previo.getFullYear()}-${String(previo.getMonth() + 1).padStart(2, '0')}`
    setCalBase(previo)
    onChange(clave, null)
    setRangeStart(null); setRangeEnd(null)
    setOpen(false)
  }

  const mesAnterior = (() => {
    const [y, m] = currentMonth.split('-').map(Number)
    const p = new Date(y, m - 2, 1)
    return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`
  })()

  function handleDayClick(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day); setRangeEnd(null); setHoverDay(null)
    } else {
      const [s, e] = isAfter(day, rangeStart) ? [rangeStart, day] : [day, rangeStart]
      setRangeStart(s); setRangeEnd(e)
      onChange(value, { start: s, end: e })
    }
  }

  function isDayInRange(day: Date) {
    const e = rangeEnd ?? (hoverDay && rangeStart && !rangeEnd ? hoverDay : null)
    if (!rangeStart || !e) return false
    const [s, en] = isAfter(e, rangeStart) ? [rangeStart, e] : [e, rangeStart]
    return isWithinInterval(day, { start: s, end: en })
  }

  const calDays = calBase ? buildDays(calBase) : []
  const now = new Date()
  const labelDate = selected ? new Date(selected + '-15') : now
  const monthLabel = format(labelDate, 'MMM yyyy', { locale: es })

  const isFullYear = dateRange?.start && dateRange?.end
    && dateRange.start.getMonth() === 0 && dateRange.start.getDate() === 1
    && dateRange.end.getMonth() === 11 && dateRange.end.getDate() === 31
    && dateRange.start.getFullYear() === dateRange.end.getFullYear()

  const semana = semanaActual(now)
  const esSemanaActual = !!dateRange && mismoDia(dateRange.start, semana.start) && mismoDia(dateRange.end, semana.end)

  let triggerLabel = monthLabel
  if (isFullYear) {
    triggerLabel = `${dateRange!.start.getFullYear()}`
  } else if (esSemanaActual) {
    triggerLabel = 'Esta semana'
  } else if (dateRange?.start && dateRange?.end) {
    const s = format(dateRange.start, "d MMM", { locale: es })
    const e = format(dateRange.end,   "d MMM", { locale: es })
    triggerLabel = `${monthLabel} · ${s}–${e}`
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      {iconOnly ? (
        <button
          onClick={() => setOpen(p => !p)}
          aria-label="Seleccionar período"
          className={`w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center transition-colors focus:outline-none ${open ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <CalendarDays className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(p => !p)}
          className={[
            'flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[13px] transition-all duration-150 focus:outline-none',
            comoPeriodo
              ? 'border-[var(--outline-variant)] bg-[var(--surface-lowest)] font-semibold text-[var(--on-surface)] hover:border-[var(--outline)]'
              : 'border-[var(--outline-variant)] bg-[var(--surface-high)] font-medium text-[var(--on-surface-variant)] hover:border-[var(--primary)] hover:text-[var(--on-surface)]',
            open ? 'border-[var(--primary)]' : '',
          ].join(' ')}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          {/* Sin el "(actual)" que iba detrás del mes: el selector ya abre en
              el mes en curso, así que aclararlo solo alargaba el botón
              (Hotman, 20-ago). */}
          <span className="hidden sm:inline capitalize">{triggerLabel}</span>
          <ChevronRight className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        </button>
      )}

      {/* Popover — en portal y posición fixed para no ser recortado por overflow del <main> */}
      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          className="z-[60] bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18)] p-4"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, animation: 'slideInUp 0.18s cubic-bezier(0.23,1,0.32,1) both' }}
        >

          {/* ── PASO 1: Selección de mes ── */}
          {step === 'month' && (
            <>
              <div className="-mx-4 -mt-4 mb-3 flex flex-wrap gap-1.5 border-b border-[var(--outline-variant)] px-4 py-3">
                {([
                  { k: 'semana'   as const, texto: 'Esta semana', activo: esSemanaActual },
                  { k: 'mes'      as const, texto: 'Este mes',   activo: value === null && !dateRange },
                  { k: 'anterior' as const, texto: 'Mes pasado', activo: value === mesAnterior && !dateRange },
                  { k: 'anio'     as const, texto: 'Este año',   activo: !!isFullYear },
                ]).map(a => (
                  <button
                    key={a.k}
                    onClick={() => atajo(a.k)}
                    className={[
                      'h-7 cursor-pointer rounded-full border px-3 text-[11.5px] transition-colors',
                      a.activo
                        ? 'border-transparent bg-[var(--primary)] font-semibold text-[var(--on-primary)]'
                        : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:border-[var(--outline)] hover:text-[var(--on-surface)]',
                    ].join(' ')}
                  >
                    {a.texto}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setViewYear(y => y - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-high)] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSelectYear}
                  title="Seleccionar año completo"
                  className="text-[var(--on-surface)] text-sm font-semibold hover:text-[var(--primary)] transition-colors px-1 rounded"
                >
                  {viewYear}
                </button>
                <button
                  onClick={() => setViewYear(y => y + 1)}
                  disabled={viewYear >= now.getFullYear()}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-high)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {MESES.map((name, i) => {
                  const monthKey  = `${viewYear}-${String(i + 1).padStart(2, '0')}`
                  const isSelected = selected === monthKey
                  const isCurrent  = monthKey === currentMonth
                  const isFuture   = monthKey > currentMonth
                  return (
                    <button
                      key={monthKey}
                      onClick={() => !isFuture && handleSelectMonth(monthKey)}
                      disabled={isFuture}
                      className={`h-9 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer
                        ${isSelected
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                          : isCurrent && !isSelected
                          ? 'bg-[var(--surface-high)] text-[var(--on-surface)] ring-1 ring-[var(--primary)]'
                          : isFuture
                          ? 'text-[var(--on-surface-variant)] opacity-30 cursor-not-allowed'
                          : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-high)] hover:text-[var(--on-surface)]'
                        }`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>

              {/* El rango de días sigue estando, pero se pide: es lo que menos
                  se usa y era lo primero que aparecía. */}
              <div className="-mx-4 -mb-4 mt-3 flex items-center justify-between gap-2 border-t border-[var(--outline-variant)] bg-[var(--surface-low)] px-4 py-2.5">
                <span className="text-[11px] text-[var(--on-surface-variant)]">¿Necesitas días sueltos?</span>
                <button
                  onClick={() => { setCalBase(calBase ?? new Date(selected + '-01')); setStep('days') }}
                  className="shrink-0 cursor-pointer text-[11.5px] font-semibold text-[var(--primary)] hover:underline"
                >
                  Elegir un rango
                </button>
              </div>
            </>
          )}

          {/* ── PASO 2: Rango de días ── */}
          {step === 'days' && calBase && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setStep('month')}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-high)] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[var(--on-surface)] text-sm font-semibold capitalize">
                  {format(calBase, 'MMMM yyyy', { locale: es })}
                </span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setCalBase(b => subMonths(b!, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-high)] transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setCalBase(b => addMonths(b!, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-high)] transition-colors"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Cabecera días semana */}
              <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[var(--on-surface-variant)] mb-1.5">
                {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => <div key={d}>{d}</div>)}
              </div>

              {/* Grid de días */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((day, idx) => {
                  const inMonth = isSameMonth(day, calBase)
                  const isStart = rangeStart ? isSameDay(day, rangeStart) : false
                  const isEnd   = rangeEnd   ? isSameDay(day, rangeEnd)   : false
                  const inRange = isDayInRange(day)
                  return (
                    <div
                      key={idx}
                      onClick={() => inMonth && handleDayClick(day)}
                      onMouseEnter={() => { if (rangeStart && !rangeEnd) setHoverDay(day) }}
                      onMouseLeave={() => setHoverDay(null)}
                      className={`h-8 flex items-center justify-center text-xs font-medium transition-all
                        ${!inMonth ? 'opacity-0 pointer-events-none' : 'cursor-pointer'}
                        ${isStart ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold rounded-l-lg rounded-r-none' : ''}
                        ${isEnd   ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold rounded-r-lg rounded-l-none' : ''}
                        ${isStart && isEnd ? '!rounded-lg' : ''}
                        ${inRange && !isStart && !isEnd ? 'bg-[var(--primary-container)] text-[var(--on-surface)] rounded-none' : ''}
                        ${inMonth && !isStart && !isEnd && !inRange ? 'text-[var(--on-surface)] hover:bg-[var(--surface-high)] hover:rounded-lg' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>

              {/* Footer acciones */}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-[var(--outline-variant)]">
                <div className="text-xs text-[var(--on-surface-variant)]">
                  {rangeStart && !rangeEnd && 'Selecciona el día final'}
                  {rangeStart && rangeEnd && (
                    <span className="text-[var(--primary)] font-medium">
                      {format(rangeStart, "d MMM", { locale: es })} – {format(rangeEnd, "d MMM", { locale: es })}
                    </span>
                  )}
                  {!rangeStart && 'Selecciona inicio'}
                </div>
                <div className="flex gap-2">
                  {(rangeStart || rangeEnd) && (
                    <button
                      onClick={() => { setRangeStart(null); setRangeEnd(null); onChange(value, null) }}
                      className="text-xs text-[var(--on-surface-variant)] hover:text-[var(--error)] transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                  {rangeStart && rangeEnd && (
                    <button
                      onClick={() => setOpen(false)}
                      className="text-xs bg-[var(--primary)] text-[var(--on-primary)] px-2.5 py-1 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                    >
                      Aplicar
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => { setRangeStart(null); setRangeEnd(null); onChange(value, null); setOpen(false) }}
                className="mt-2 w-full text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors py-1"
              >
                Ver todo el mes
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
