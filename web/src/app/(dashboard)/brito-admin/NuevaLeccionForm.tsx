'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { crearLeccion } from './acciones'

export function NuevaLeccionForm({ materias }: { materias: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [materia, setMateria] = useState(materias[0])
  const [titulo, setTitulo] = useState('')
  const [orden, setOrden] = useState(1)
  const [sesion, setSesion] = useState('1')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> Nueva lección
      </button>
    )
  }

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-on-surface">Nueva lección</p>
        <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Select
          value={materia}
          onValueChange={setMateria}
          options={materias.map(m => ({ value: m, label: m }))}
          className="col-span-1"
        />
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Título de la lección"
          className="col-span-1 px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface"
        />
        <input
          type="number"
          value={orden}
          onChange={e => setOrden(Number(e.target.value))}
          placeholder="Orden"
          className="col-span-1 px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface"
        />
        <Select
          value={sesion}
          onValueChange={setSesion}
          options={[
            { value: '1', label: 'Sesión 1' },
            { value: '2', label: 'Sesión 2' },
          ]}
          className="col-span-1"
        />
      </div>

      <button
        disabled={!titulo.trim() || pending}
        onClick={() => startTransition(async () => {
          const res = await crearLeccion({ materia, titulo: titulo.trim(), orden, sesion: Number(sesion) })
          if (res.ok) {
            setTitulo('')
            setOpen(false)
            router.push(`/brito-admin/${res.id}`)
          }
        })}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Crear y agregar preguntas
      </button>
    </div>
  )
}
