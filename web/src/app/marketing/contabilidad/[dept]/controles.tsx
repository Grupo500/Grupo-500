'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send, UserPlus } from 'lucide-react'
import { crearPersona, enviarQuincena } from '../acciones'

// Envía la quincena del departamento a contabilidad (la congela para el líder)
export function BotonEnviar({ deptId, quincena, total }: { deptId: string; quincena: string; total: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [pendiente, startTransition] = useTransition()

  const enviar = () => {
    startTransition(async () => {
      const r = await enviarQuincena(deptId, quincena)
      if (r.error) setError(r.error)
      setConfirmando(false)
    })
  }

  if (error) return <span className="text-xs text-error">{error}</span>

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-105 transition-all"
      >
        <Send className="w-3.5 h-3.5" /> Enviar a contabilidad
      </button>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-on-surface-variant">¿Enviar {total}? Ya no podrás editar la quincena.</span>
      <button onClick={enviar} disabled={pendiente}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-60">
        {pendiente && <Loader2 className="w-3 h-3 animate-spin" />} Sí, enviar
      </button>
      <button onClick={() => setConfirmando(false)} disabled={pendiente}
        className="px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant">
        Cancelar
      </button>
    </span>
  )
}

// Alta de una persona del equipo del departamento
export function FormPersona({ deptId, esAdmin }: { deptId: string; esAdmin: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  const [pendiente, startTransition] = useTransition()

  const enviar = (fd: FormData) => {
    setError('')
    startTransition(async () => {
      const r = await crearPersona({
        deptId,
        nombre: String(fd.get('nombre') ?? ''),
        cedula: String(fd.get('cedula') ?? ''),
        rolTexto: String(fd.get('rol') ?? ''),
      })
      if (r.error) setError(r.error)
      else setAbierto(false)
    })
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" /> Agregar persona
      </button>
    )
  }

  return (
    <form action={enviar} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 space-y-3 max-w-md">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
        <UserPlus className="w-4 h-4 text-primary" /> Nueva persona
      </p>
      <input name="nombre" required placeholder="Nombre completo"
        className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />
      <div className="grid grid-cols-2 gap-2">
        <input name="cedula" placeholder={esAdmin ? 'Cédula (para Siigo)' : 'Cédula'}
          className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />
        <input name="rol" placeholder="Rol (ej. Freelance)"
          className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />
      </div>
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
