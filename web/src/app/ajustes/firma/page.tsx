'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { Pen, Upload, Loader2 } from 'lucide-react'
import type { Firmas } from '@/lib/certificados'

function FirmaCard({ nombre, cargo, url, onUpload, uploading }: {
  nombre: string; cargo: string; url: string | null
  onUpload: (file: File) => void; uploading: boolean
}) {
  return (
    <div className="card p-4 flex flex-col gap-3 max-w-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center flex-shrink-0">
          <Pen className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-on-surface">{nombre}</p>
          <p className="text-[11px] text-on-surface-variant">{cargo}</p>
        </div>
      </div>

      <div className="h-20 rounded-lg border border-outline-variant bg-[var(--surface-high)] flex items-center justify-center overflow-hidden">
        {url
          ? <img src={url} alt={`Firma ${nombre}`} className="max-h-full max-w-full object-contain p-2" />
          : <p className="text-[11px] text-on-surface-variant">Sin firma cargada</p>
        }
      </div>

      <label className={cn(
        'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors',
        uploading
          ? 'border-outline-variant text-on-surface-variant opacity-60 cursor-not-allowed'
          : 'border-primary/30 text-primary hover:bg-primary/5',
      )}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {url ? 'Reemplazar firma' : 'Cargar firma'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

export default function AjustesFirmaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [subiendo, setSubiendo] = useState<'andres' | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) router.replace('/ajustes')
  }, [status, isAdmin, router])

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data: firmasData, refetch: refetchFirmas } = useQuery({
    queryKey: ['config-firmas'],
    queryFn: () => fetcher<{ data: Firmas }>('/config/firmas'),
    enabled: isAdmin,
  })
  const firmas: Firmas = firmasData?.data ?? { firmaSebastian: null, firmaAndres: null }

  const handleSubirFirma = async (quien: 'andres', file: File) => {
    setSubiendo(quien)
    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('firma', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/config/firmas/${quien}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      if (!res.ok) throw new Error('Error al subir firma')
      await refetchFirmas()
    } catch (e: any) {
      alert(e?.message ?? 'Error al subir la firma')
    } finally {
      setSubiendo(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Firma" subtitle="Firma del representante legal usada en los certificados" />

      <FirmaCard
        nombre="Andrés Felipe Díaz Rivero"
        cargo="CC: 1005480173 · Bucaramanga · Representante Legal"
        url={firmas.firmaAndres}
        uploading={subiendo === 'andres'}
        onUpload={f => handleSubirFirma('andres', f)}
      />
    </div>
  )
}
