'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { eliminarLeccion } from './acciones'

export function EliminarLeccionBoton({ leccionId, titulo }: { leccionId: string; titulo: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Eliminar la lección "${titulo}"? Esto no se puede deshacer.`)) return
    startTransition(async () => {
      await eliminarLeccion(leccionId)
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title="Eliminar lección"
      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
