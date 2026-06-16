'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import {
  ArrowLeft, BookOpen, Package, Users, Search, CalendarDays,
  Mail, Phone, MapPin, Clock,
} from 'lucide-react'

interface Inscrito {
  id: string
  fechaCompra: string
  precioAcordado: number | null
  estudiante: {
    id: string
    nombre: string
    email: string
    telefono: string
    ciudad: string | null
    verificado: boolean
    asesor: { nombre: string } | null
  }
}
interface CursoDetalle {
  id: string
  nombre: string
  precio: number
  duracionHoras: number
  activo: boolean
  tipoCurso: 'INDIVIDUAL' | 'COMBO'
  fechaInicio: string | null
  fechaFin: string | null
  _count: { estudiantes: number }
  estudiantes: Inscrito[]
}

function iniciales(n: string) {
  return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function fmtFecha(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CursoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['curso-detalle', id],
    queryFn: () => apiFetch<{ data: CursoDetalle }>(`/cursos/${id}`),
    staleTime: 30_000,
  })

  const curso = data?.data
  const isCombo = curso?.tipoCurso === 'COMBO'

  const inscritos = (curso?.estudiantes ?? []).filter(i =>
    i.estudiante.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.estudiante.email.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Volver */}
      <Link href="/cursos" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors">
        <ArrowLeft className="w-4 h-4" /> Cursos
      </Link>

      {/* Header del curso */}
      <div className="card p-5">
        {isLoading ? (
          <div className="h-16 rounded-xl bg-surface-high animate-pulse" />
        ) : !curso ? (
          <p className="text-[14px] text-on-surface-variant">Curso no encontrado.</p>
        ) : (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border mb-2 ${
                isCombo ? 'bg-amber-50 text-amber-600 border-amber-200/70' : 'bg-primary/8 text-primary border-primary/15'
              }`}>
                {isCombo ? <Package className="w-2.5 h-2.5" /> : <BookOpen className="w-2.5 h-2.5" />}
                {isCombo ? 'Combo' : 'Individual'}
              </span>
              <h1 className="text-[20px] font-bold text-on-surface tracking-tight leading-tight">{curso.nombre}</h1>
              <div className="flex items-center gap-3 mt-2 text-[12px] text-on-surface-variant flex-wrap">
                <span className={`text-[18px] font-bold tabular-nums ${isCombo ? 'text-amber-500' : 'text-primary'}`}>{formatCOP(curso.precio)}</span>
                {curso.duracionHoras > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {curso.duracionHoras}h</span>}
                {(curso.fechaInicio || curso.fechaFin) && (
                  <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtFecha(curso.fechaInicio)}{curso.fechaFin ? ` → ${fmtFecha(curso.fechaFin)}` : ''}</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[28px] font-bold text-on-surface tabular-nums leading-none">{curso._count.estudiantes}</p>
              <p className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1 justify-end"><Users className="w-3 h-3" /> estudiantes</p>
            </div>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar estudiante por nombre o correo..."
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-lowest border border-outline-variant text-[14px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Lista de estudiantes */}
      <div className="card p-5">
        <p className="text-[13px] font-semibold text-on-surface mb-3">
          Estudiantes registrados {curso && <span className="text-on-surface-variant font-normal">· {inscritos.length}</span>}
        </p>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-surface-high animate-pulse" />)}</div>
        ) : inscritos.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-8">
            {busqueda ? 'Sin resultados para tu búsqueda' : 'Aún no hay estudiantes registrados en este curso'}
          </p>
        ) : (
          <div className="space-y-2">
            {inscritos.map((i) => (
              <Link
                key={i.id}
                href={`/estudiantes/${i.estudiante.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/50 bg-surface-lowest hover:bg-surface-high/50 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/10">
                  <span className="text-[12px] font-bold text-primary">{iniciales(i.estudiante.nombre)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{i.estudiante.nombre}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-on-surface-variant flex-wrap">
                    <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {i.estudiante.email}</span>
                    {i.estudiante.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {i.estudiante.telefono}</span>}
                    {i.estudiante.ciudad && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {i.estudiante.ciudad}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-[11px] text-on-surface-variant">{fmtFecha(i.fechaCompra)}</p>
                  {i.estudiante.asesor && <p className="text-[11px] font-medium text-on-surface mt-0.5 truncate max-w-[140px]">{i.estudiante.asesor.nombre}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
