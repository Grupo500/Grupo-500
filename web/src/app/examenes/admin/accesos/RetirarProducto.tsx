'use client'

import { useState, useTransition } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { retirarAccesosDeExamen } from './acciones'

// Baja de producto (PRD §6.2): retira todos los accesos activos del examen.
// Los estudiantes dejan de verlo; los resultados históricos se conservan.
export default function RetirarProducto({ examenId, habilitados }: { examenId: number; habilitados: number }) {
  const [confirmando, setConfirmando] = useState(false)
  const [pendiente, startTransition] = useTransition()

  if (habilitados === 0) return null

  const retirar = () => {
    startTransition(async () => {
      await retirarAccesosDeExamen(examenId)
      setConfirmando(false)
    })
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        title="Retirar el producto: los estudiantes dejan de verlo; sus resultados se conservan"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-error hover:border-error/40 transition-colors"
      >
        <Archive className="w-3.5 h-3.5" /> Retirar
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-on-surface-variant">¿Retirar los {habilitados} accesos?</span>
      <button
        onClick={retirar}
        disabled={pendiente}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-error text-white text-xs font-semibold disabled:opacity-60"
      >
        {pendiente && <Loader2 className="w-3 h-3 animate-spin" />} Sí, retirar
      </button>
      <button
        onClick={() => setConfirmando(false)}
        disabled={pendiente}
        className="px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant"
      >
        Cancelar
      </button>
    </span>
  )
}
