'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { UserCheck, Mail, Phone, Loader2 } from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  email: string
  telefono: string
  user: { role: string }
  createdAt: string
  _count?: { pagos: number; estudiantes: number }
}

export default function AsesoresPage() {
  const { getToken } = useAuth()

  const fetcher = async <T,>(path: string) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path)
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['asesores'],
    queryFn: () => fetcher<any>('/asesores'),
  })

  const asesores: Asesor[] = data?.data ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Asesores" subtitle="Equipo de ventas" />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl">
          <p className="text-sm text-[var(--error)]">Error al cargar asesores</p>
          <p className="text-xs mt-1 opacity-60">{String(error)}</p>
        </div>
      ) : asesores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl">
          <UserCheck className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay asesores registrados</p>
          <p className="text-xs mt-1 opacity-60">Los usuarios se registran en la app y aparecen aquí automáticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {asesores.map(a => (
            <div key={a.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{a.nombre[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{a.nombre}</p>
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">{a.user?.role}</span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{a.email}</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />{a.telefono}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant/40 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{a._count?.estudiantes ?? 0}</p>
                  <p className="text-[11px] text-on-surface-variant">Estudiantes</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{a._count?.pagos ?? 0}</p>
                  <p className="text-[11px] text-on-surface-variant">Pagos</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
