'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn, formatCOP } from '@/lib/utils'
import { ErrorGastos } from '@/lib/gastosAgenciaApi'

/**
 * Celda de tabla que se edita en el sitio y escribe en el Google Sheet.
 *
 * Guarda al salir del campo o con Enter, cancela con Escape. Mientras guarda
 * muestra el valor nuevo (no un spinner que tape la cifra) para que la tabla no
 * salte, y si el servidor responde 409 devuelve la celda al valor que tiene el
 * sheet ahora, porque significa que alguien lo cambió por allá.
 */
export function CeldaEditable({
  valor, formato = 'moneda', editable = true, alGuardar, className, alineacion = 'right', vacioComo = '—',
}: {
  valor: number | null
  formato?: 'moneda' | 'entero'
  editable?: boolean
  /** Debe rechazar con ErrorGastos si el servidor no acepta el cambio. */
  alGuardar: (nuevo: number | null) => Promise<unknown>
  className?: string
  alineacion?: 'left' | 'right'
  vacioComo?: string
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const [local, setLocal] = useState<number | null>(valor)
  const input = useRef<HTMLInputElement>(null)

  // El valor de arriba manda: tras refrescar la consulta hay que soltar el local.
  useEffect(() => { setLocal(valor) }, [valor])

  useEffect(() => {
    if (editando) { input.current?.focus(); input.current?.select() }
  }, [editando])

  const mostrar = (v: number | null) => {
    if (v == null || v === 0) return v === 0 ? (formato === 'moneda' ? formatCOP(0) : '0') : vacioComo
    return formato === 'moneda' ? formatCOP(v) : v.toLocaleString('es-CO')
  }

  function abrir() {
    if (!editable || guardando) return
    setProblema(null)
    setTexto(local == null ? '' : String(local))
    setEditando(true)
  }

  async function confirmar() {
    setEditando(false)
    const limpio = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const nuevo = limpio.trim() === '' ? null : Number(limpio)

    if (nuevo != null && !Number.isFinite(nuevo)) { setProblema('Eso no es un número'); return }
    if (nuevo != null && nuevo < 0) { setProblema('No acepto negativos'); return }
    if ((nuevo ?? null) === (local ?? null)) return // nada cambió

    const previo = local
    setLocal(nuevo)          // optimista: la cifra cambia ya
    setGuardando(true)
    setProblema(null)
    try {
      await alGuardar(nuevo)
    } catch (e) {
      if (e instanceof ErrorGastos && e.esConflicto) {
        const actual = typeof e.valorActual === 'number' ? e.valorActual : null
        setLocal(actual)
        setProblema(`En el sheet ahora dice ${mostrar(actual)}`)
      } else {
        setLocal(previo)     // se revierte: el sheet no cambió
        setProblema(e instanceof Error ? e.message : 'No pude guardar')
      }
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <input
        ref={input}
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar() }
          if (e.key === 'Escape') { e.preventDefault(); setEditando(false) }
        }}
        className={cn(
          'w-full min-w-[92px] px-1.5 py-1 rounded-md bg-surface-container-lowest',
          'border border-primary text-[12px] tabular-nums text-on-surface outline-none',
          alineacion === 'right' && 'text-right',
          className,
        )}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={!editable}
      title={problema ?? (editable ? 'Clic para editar; se guarda en el Google Sheet' : undefined)}
      className={cn(
        'group w-full px-1.5 py-1 rounded-md text-[12px] tabular-nums transition-colors',
        alineacion === 'right' ? 'text-right' : 'text-left',
        editable ? 'cursor-pointer hover:bg-surface-high' : 'cursor-default',
        problema ? 'text-amber-600' : local == null ? 'text-on-surface-variant/45' : 'text-on-surface',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 justify-end w-full">
        {guardando && <Loader2 className="w-3 h-3 animate-spin shrink-0 opacity-70" />}
        {problema && !guardando && <AlertTriangle className="w-3 h-3 shrink-0" />}
        {mostrar(local)}
      </span>
      {problema && (
        <span className="block text-[9.5px] leading-tight text-amber-600 font-medium mt-0.5 text-right">
          {problema}
        </span>
      )}
    </button>
  )
}

/** Igual que la anterior pero para texto corto (por ejemplo el banco). */
export function CeldaTextoEditable({
  valor, editable = true, alGuardar, placeholder = '—',
}: {
  valor: string
  editable?: boolean
  alGuardar: (nuevo: string) => Promise<unknown>
  placeholder?: string
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)
  const [local, setLocal] = useState(valor)
  const [guardando, setGuardando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(valor) }, [valor])
  useEffect(() => { if (editando) { input.current?.focus(); input.current?.select() } }, [editando])

  async function confirmar() {
    setEditando(false)
    const nuevo = texto.trim()
    if (nuevo === local.trim()) return

    const previo = local
    setLocal(nuevo)
    setGuardando(true)
    setProblema(null)
    try {
      await alGuardar(nuevo)
    } catch (e) {
      if (e instanceof ErrorGastos && e.esConflicto) {
        const actual = String(e.valorActual ?? '')
        setLocal(actual)
        setProblema(`En el sheet dice «${actual}»`)
      } else {
        setLocal(previo)
        setProblema(e instanceof Error ? e.message : 'No pude guardar')
      }
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <input
        ref={input}
        type="text"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar() }
          if (e.key === 'Escape') { e.preventDefault(); setEditando(false) }
        }}
        className="w-full min-w-[110px] px-1.5 py-1 rounded-md bg-surface-container-lowest border border-primary text-[12px] text-on-surface outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { if (editable && !guardando) { setTexto(local); setProblema(null); setEditando(true) } }}
      disabled={!editable}
      className={cn(
        'w-full text-left px-1.5 py-1 rounded-md text-[12px] transition-colors',
        editable ? 'cursor-pointer hover:bg-surface-high' : 'cursor-default',
        local ? 'text-on-surface-variant' : 'text-on-surface-variant/45',
      )}
    >
      <span className="inline-flex items-center gap-1">
        {guardando && <Loader2 className="w-3 h-3 animate-spin opacity-70" />}
        {local || placeholder}
      </span>
      {problema && (
        <span className="block text-[9.5px] leading-tight text-amber-600 font-medium mt-0.5">{problema}</span>
      )}
    </button>
  )
}

/** Interruptor Sí/No que escribe en el sheet, con el mismo manejo de conflictos. */
export function InterruptorEditable({
  valor, editable = true, alGuardar,
}: {
  valor: boolean
  editable?: boolean
  alGuardar: (nuevo: boolean) => Promise<unknown>
}) {
  const [local, setLocal] = useState(valor)
  const [guardando, setGuardando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)

  useEffect(() => { setLocal(valor) }, [valor])

  async function alternar() {
    if (!editable || guardando) return
    const previo = local
    const nuevo = !local
    setLocal(nuevo)
    setGuardando(true)
    setProblema(null)
    try {
      await alGuardar(nuevo)
    } catch (e) {
      if (e instanceof ErrorGastos && e.esConflicto) {
        const actual = String(e.valorActual ?? '').toUpperCase().startsWith('S')
        setLocal(actual)
        setProblema(`En el sheet dice ${actual ? 'Sí' : 'No'}`)
      } else {
        setLocal(previo)
        setProblema(e instanceof Error ? e.message : 'No pude guardar')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={alternar}
        disabled={!editable || guardando}
        title={editable ? 'Clic para cambiar el estado de pago en el sheet' : undefined}
        className={cn(
          'inline-flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold transition-opacity',
          local ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-600',
          editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
          guardando && 'opacity-60',
        )}
      >
        {guardando && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        {local ? 'Sí' : 'No'}
      </button>
      {problema && <span className="text-[9px] text-amber-600 font-medium leading-tight">{problema}</span>}
    </span>
  )
}
