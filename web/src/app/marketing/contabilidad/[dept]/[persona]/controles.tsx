'use client'

import { useState, useTransition } from 'react'
import { BadgeCheck, Banknote, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  aprobarRegistro, aprobarTodo, crearRegistro, editarValor, eliminarRegistro,
  marcarPagado, marcarRevisado, pagarQuincenaPersona, rechazarRegistro,
} from '../../acciones'

const btn = 'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50'

// Botonera de un registro. Quien aprueba es el líder del área o contabilidad;
// pagar es solo de contabilidad. El rechazo abre un campo de motivo porque sin
// él la persona no sabe qué corregir, y corregir el valor deja rastro del que
// traía.
export function AccionesRegistro({
  id, esAdmin, puedeAprobar, congelada, revisado, aprobado, rechazado, pagado, valor,
}: {
  id: string
  esAdmin: boolean
  puedeAprobar: boolean
  congelada: boolean
  revisado: boolean
  aprobado: boolean
  rechazado: boolean
  pagado: boolean
  valor: number
}) {
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [motivo, setMotivo] = useState<string | null>(null)
  const [nuevoValor, setNuevoValor] = useState<string | null>(null)

  const correr = (fn: () => Promise<{ error?: string }>) => {
    setError('')
    startTransition(async () => {
      const r = await fn()
      if (r.error) setError(r.error)
      else { setMotivo(null); setNuevoValor(null) }
    })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
      {error && <span className="text-[11px] text-error w-full">{error}</span>}

      {motivo !== null && (
        <div className="w-full flex items-center gap-1.5 flex-wrap">
          <input
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="¿Por qué se rechaza?"
            className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-surface-lowest border border-outline-variant text-[11px] text-on-surface"
          />
          <button disabled={pendiente} onClick={() => correr(() => rechazarRegistro(id, true, motivo))}
            className={`${btn} bg-error-container text-error`}>Rechazar</button>
          <button disabled={pendiente} onClick={() => { setMotivo(null); setError('') }}
            className={`${btn} bg-surface-high text-on-surface-variant border border-outline-variant`}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {nuevoValor !== null && (
        <div className="w-full flex items-center gap-1.5 flex-wrap">
          <input
            autoFocus
            inputMode="numeric"
            value={nuevoValor}
            onChange={e => setNuevoValor(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Nuevo valor"
            className="w-32 px-2.5 py-1.5 rounded-lg bg-surface-lowest border border-outline-variant text-[11px] text-on-surface tabular-nums"
          />
          <button disabled={pendiente} onClick={() => correr(() => editarValor(id, Number(nuevoValor)))}
            className={`${btn} bg-primary text-on-primary`}>
            <Check className="w-3 h-3" />
          </button>
          <button disabled={pendiente} onClick={() => { setNuevoValor(null); setError('') }}
            className={`${btn} bg-surface-high text-on-surface-variant border border-outline-variant`}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {!congelada && !pagado && (
        <button disabled={pendiente} onClick={() => correr(() => marcarRevisado(id, !revisado))}
          className={`${btn} ${revisado ? 'bg-[#e8eefc] text-[#2c5cc5]' : 'bg-surface-high text-on-surface-variant border border-outline-variant'}`}>
          {revisado ? 'Revisado ✓' : 'Revisar'}
        </button>
      )}

      {puedeAprobar && !pagado && (
        <>
          <button disabled={pendiente} onClick={() => correr(() => aprobarRegistro(id, !aprobado))}
            className={`${btn} ${aprobado ? 'bg-[#e3f2e6] text-[#1b7a3d]' : 'bg-surface-high text-on-surface-variant border border-outline-variant'}`}>
            {aprobado ? 'Aprobado ✓' : 'Aprobar'}
          </button>
          <button disabled={pendiente}
            onClick={() => rechazado ? correr(() => rechazarRegistro(id, false)) : setMotivo('')}
            className={`${btn} ${rechazado ? 'bg-error-container text-error' : 'bg-surface-high text-on-surface-variant border border-outline-variant'}`}>
            {rechazado ? 'Rechazado ✓' : 'Rechazar'}
          </button>
          <button disabled={pendiente} title="Corregir el valor"
            onClick={() => setNuevoValor(String(valor))}
            className={`${btn} bg-surface-high text-on-surface-variant border border-outline-variant`}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {esAdmin && aprobado && !rechazado && (
        <button disabled={pendiente} onClick={() => correr(() => marcarPagado(id, !pagado))}
          className={`${btn} ${pagado ? 'bg-primary-container text-secondary' : 'bg-primary text-on-primary'}`}>
          {pagado ? 'Pago realizado ✓' : 'Marcar pagado'}
        </button>
      )}

      {!pagado && (!congelada || esAdmin) && !aprobado && (
        <button disabled={pendiente} title="Eliminar registro" onClick={() => correr(() => eliminarRegistro(id))}
          className={`${btn} bg-surface-high text-on-surface-variant border border-outline-variant hover:text-error`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin text-on-surface-variant" />}
    </div>
  )
}

/** Aprueba de un golpe todo lo que el área tiene pendiente en la quincena. */
export function BotonAprobarTodo({ deptId, quincena, pendientes }: {
  deptId: string; quincena: string; pendientes: number
}) {
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        disabled={pendiente}
        onClick={() => startTransition(async () => {
          const r = await aprobarTodo(deptId, quincena)
          if (r.error) setError(r.error)
        })}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e3f2e6] text-[#1b7a3d] text-xs font-semibold disabled:opacity-60"
      >
        {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
        Aprobar {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
      </button>
      {error && <span className="text-[11px] text-error">{error}</span>}
    </div>
  )
}

export function BotonPagarTodo({ personaId, quincena, pendientes }: { personaId: string; quincena: string; pendientes: number }) {
  const [pendiente, startTransition] = useTransition()
  return (
    <button
      disabled={pendiente}
      onClick={() => startTransition(async () => { await pagarQuincenaPersona(personaId, quincena) })}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
    >
      {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
      Pagar {pendientes} {pendientes === 1 ? 'aprobado' : 'aprobados'}
    </button>
  )
}

// Alta de una actividad de la quincena, con las tarifas del departamento como atajos
export function FormRegistro({ personaId, quincena, categorias, tarifas }: {
  personaId: string
  quincena: string
  categorias: string[]
  tarifas: { label: string; valor: number }[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [pendiente, startTransition] = useTransition()

  const enviar = (fd: FormData) => {
    setError('')
    startTransition(async () => {
      const r = await crearRegistro({
        personaId,
        quincena,
        categoria: String(fd.get('categoria') ?? ''),
        actividad: String(fd.get('actividad') ?? ''),
        valor: Number(fd.get('valor') ?? 0),
        link: String(fd.get('link') ?? ''),
      })
      if (r.error) setError(r.error)
      else { setAbierto(false); setValor('') }
    })
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-105 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> Registrar actividad
      </button>
    )
  }

  return (
    <form action={enviar} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 space-y-3 max-w-xl">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
        <BadgeCheck className="w-4 h-4 text-primary" /> Nueva actividad
      </p>
      <input name="actividad" required placeholder="¿Qué se hizo? (ej. Reel lanzamiento Año 500)"
        className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select name="categoria" className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface">
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          name="valor" type="number" min={1} required placeholder="Valor en COP"
          value={valor} onChange={e => setValor(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60"
        />
      </div>
      {tarifas.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {tarifas.map(t => (
            <button key={t.label} type="button" onClick={() => setValor(String(t.valor))}
              className="text-[11px] px-2.5 py-1 rounded-full bg-surface-high text-on-surface-variant border border-outline-variant hover:border-primary/40 hover:text-primary transition-colors">
              {t.label} · ${t.valor.toLocaleString('es-CO')}
            </button>
          ))}
        </div>
      )}
      <input name="link" placeholder="Link de evidencia (Drive, opcional)"
        className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pendiente}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-60">
          {pendiente && <Loader2 className="w-3 h-3 animate-spin" />} Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)}
          className="px-3.5 py-2 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant">
          Cancelar
        </button>
      </div>
    </form>
  )
}
