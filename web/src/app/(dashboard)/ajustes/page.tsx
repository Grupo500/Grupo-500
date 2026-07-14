'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import {
  Pen, Upload, Loader2, KeyRound, Plus, Trash2, X, Copy, Check, ShieldAlert,
  User, Save, Lock, type LucideIcon,
} from 'lucide-react'
import type { Firmas } from '@/lib/certificados'

// ── Tipos ────────────────────────────────────────────────────────────────
interface ApiKey {
  id: string
  nombre: string
  prefijo: string
  scopes: string[]
  activa: boolean
  ultimoUso: string | null
  createdAt: string
  revocadaAt: string | null
  creadaPor: { nombre: string | null; email: string }
}
interface MiAsesor { id: string; nombre: string; telefono: string; email: string }

type Tab = 'perfil' | 'firma' | 'apikeys'

// ── Tarjeta de firma ─────────────────────────────────────────────────────
function FirmaCard({ nombre, cargo, url, onUpload, uploading }: {
  nombre: string; cargo: string; url: string | null
  onUpload: (file: File) => void; uploading: boolean
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
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

// ── Tab: Mi perfil ───────────────────────────────────────────────────────
function TabPerfil({ fetcher, userId }: {
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  userId: string
}) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargado, setCargado] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  const { data } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: () => fetcher<{ data: MiAsesor }>('/asesores/me'),
  })

  const mia = data?.data
  if (mia && !cargado) {
    setNombre(mia.nombre)
    setTelefono(mia.telefono)
    setCargado(true)
  }

  const guardar = useMutation({
    mutationFn: () => fetcher(`/asesores/${mia!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mi-perfil'] }),
    onError: (e: any) => alert(e?.message ?? 'Error al guardar'),
  })

  const cambiarPassword = useMutation({
    mutationFn: () => fetcher(`/auth/usuarios/${userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
    onSuccess: () => { setPassword(''); setPasswordMsg('Contraseña actualizada') },
    onError: (e: any) => setPasswordMsg(e?.message ?? 'Error al cambiar contraseña'),
  })

  return (
    <div className="space-y-6 max-w-md">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-on-surface">Datos personales</p>
        </div>
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="input-base" />
        </div>
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Teléfono</label>
          <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="input-base" />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => guardar.mutate()}
            disabled={!nombre.trim() || !telefono.trim() || guardar.isPending}
            className="btn-primary"
          >
            {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-on-surface">Contraseña</p>
        </div>
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPasswordMsg('') }}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className="input-base"
          />
          {passwordMsg && <p className="text-[11px] mt-1 text-on-surface-variant">{passwordMsg}</p>}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => cambiarPassword.mutate()}
            disabled={password.length < 8 || cambiarPassword.isPending}
            className="btn-primary"
          >
            {cambiarPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Firma ───────────────────────────────────────────────────────────
function TabFirma({ fetcher }: { fetcher: <T>(path: string, opts?: RequestInit) => Promise<T> }) {
  const [subiendo, setSubiendo] = useState<'andres' | null>(null)

  const { data: firmasData, refetch: refetchFirmas } = useQuery({
    queryKey: ['config-firmas'],
    queryFn: () => fetcher<{ data: Firmas }>('/config/firmas'),
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

  return (
    <div className="space-y-3 max-w-md">
      <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
        Firma del representante legal
      </p>
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

// ── Tab: API Keys ────────────────────────────────────────────────────────
function TabApiKeys({ fetcher }: { fetcher: <T>(path: string, opts?: RequestInit) => Promise<T> }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [keyCreada, setKeyCreada] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const { data, isLoading } = useQuery<{ data: ApiKey[] }>({
    queryKey: ['api-keys'],
    queryFn: () => fetcher<{ data: ApiKey[] }>('/apikeys'),
  })

  const crear = useMutation({
    mutationFn: () =>
      fetcher<{ data: ApiKey & { key: string } }>('/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNueva.trim(), scopes: [] }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setKeyCreada(res.data.key)
      setNombreNueva('')
    },
  })

  const revocar = useMutation({
    mutationFn: (id: string) => fetcher(`/apikeys/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const keys = data?.data ?? []

  function cerrarModal() {
    setShowModal(false)
    setKeyCreada(null)
    setCopiado(false)
  }

  function copiarKey() {
    if (!keyCreada) return
    navigator.clipboard.writeText(keyCreada)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15 flex-1">
          <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Estas keys dan acceso de <strong className="text-on-surface">solo lectura</strong> a estudiantes, pagos, cursos y reportes vía <code className="text-[11px]">/api/public/v1/*</code>. El secreto solo se muestra una vez al crearla.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="ml-3 flex items-center gap-2 px-3 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Crear key</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Cargando...</span>
          </div>
        )}
        {!isLoading && keys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <KeyRound className="w-8 h-8 text-on-surface-variant opacity-40" />
            <p className="text-sm text-on-surface-variant">No hay API keys creadas todavía</p>
          </div>
        )}

        {!isLoading && keys.length > 0 && (
          <div className="divide-y divide-outline-variant/40">
            {keys.map(k => (
              <div key={k.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface truncate">{k.nombre}</p>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-md text-[9px] font-bold',
                      k.activa ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-[var(--error)]/15 text-[var(--error)]'
                    )}>
                      {k.activa ? 'Activa' : 'Revocada'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-mono">{k.prefijo}••••••••••••</p>
                  <p className="text-[11px] text-on-surface-variant/70 mt-1">
                    Creada {formatDate(k.createdAt)} por {k.creadaPor.nombre ?? k.creadaPor.email}
                    {k.ultimoUso && ` · Último uso ${formatDate(k.ultimoUso)}`}
                  </p>
                </div>
                {k.activa && (
                  <button
                    onClick={() => { if (confirm(`¿Revocar la key "${k.nombre}"? Dejará de funcionar de inmediato.`)) revocar.mutate(k.id) }}
                    disabled={revocar.isPending}
                    className="p-2 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-40 flex-shrink-0"
                    title="Revocar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative card w-full max-w-md p-6 space-y-5 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    {keyCreada ? 'Key creada' : 'Crear API key'}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {keyCreada ? 'Cópiala ahora — no se volverá a mostrar' : 'Solo lectura sobre datos de la app'}
                  </p>
                </div>
                <button onClick={cerrarModal} className="p-1.5 rounded-md text-on-surface-variant hover:bg-[var(--surface-high)]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!keyCreada ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={nombreNueva}
                      onChange={e => setNombreNueva(e.target.value)}
                      placeholder="Ej: GPT de ventas, Zapier..."
                      className="input-base"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={cerrarModal} className="btn-ghost">Cancelar</button>
                    <button
                      onClick={() => crear.mutate()}
                      disabled={!nombreNueva.trim() || crear.isPending}
                      className="btn-primary"
                    >
                      {crear.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Crear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--error)]/8 border border-[var(--error)]/20">
                    <ShieldAlert className="w-4 h-4 text-[var(--error)] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-on-surface leading-relaxed">
                      Guárdala en un lugar seguro. Por seguridad, no podrás volver a verla completa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-high border border-outline-variant rounded-lg px-3 py-2.5">
                    <code className="text-xs font-mono text-on-surface flex-1 truncate">{keyCreada}</code>
                    <button onClick={copiarKey} className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0">
                      {copiado ? <Check className="w-4 h-4 text-[#16a34a]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={cerrarModal} className="btn-primary">Listo</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────
export default function AjustesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [tab, setTab] = useState<Tab>('perfil')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const TABS: { key: Tab; label: string; icon: LucideIcon; adminOnly: boolean }[] = [
    { key: 'perfil',  label: 'Mi perfil', icon: User,     adminOnly: false },
    { key: 'firma',   label: 'Firma',     icon: Pen,      adminOnly: true  },
    { key: 'apikeys', label: 'API Keys',  icon: KeyRound, adminOnly: true  },
  ]
  const tabsVisibles = TABS.filter(t => !t.adminOnly || isAdmin)

  if (!session?.user) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Ajustes" subtitle="Tu perfil y configuración general del sistema" />

      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-high border border-outline-variant/40 max-w-md">
        {tabsVisibles.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer',
                tab === t.key ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'perfil' && <TabPerfil fetcher={fetcher} userId={session.user.id} />}
      {tab === 'firma' && isAdmin && <TabFirma fetcher={fetcher} />}
      {tab === 'apikeys' && isAdmin && <TabApiKeys fetcher={fetcher} />}
    </div>
  )
}
