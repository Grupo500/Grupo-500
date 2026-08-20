'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  Instagram, Facebook, Link2, Loader2, Plus, Trash2, Ban, Send,
  Clock, CheckCircle2, AlertCircle, ImageIcon, Film, Settings2,
} from 'lucide-react'

/**
 * Marketing > Redes: vincular cuentas de Instagram/Facebook (OAuth de Meta) y
 * programar posts, historias y reels. El API guarda las publicaciones y un
 * job del servidor las sube a la Graph API a la hora programada.
 */

interface Cuenta {
  id: string
  plataforma: 'INSTAGRAM' | 'FACEBOOK'
  nombre: string
  fotoUrl: string | null
}
interface Publicacion {
  id: string
  tipo: 'POST' | 'HISTORIA' | 'REEL'
  caption: string | null
  mediaUrl: string | null
  mediaEsVideo: boolean
  programadaPara: string
  estado: 'PROGRAMADA' | 'PUBLICANDO' | 'PUBLICADA' | 'ERROR' | 'CANCELADA'
  error: string | null
  publicadaEn: string | null
  cuenta: Cuenta
}

const TIPO_LABEL = { POST: 'Post', HISTORIA: 'Historia', REEL: 'Reel' } as const

const ESTADO_CHIP: Record<Publicacion['estado'], { label: string; cls: string }> = {
  PROGRAMADA: { label: 'Programada', cls: 'bg-primary-container text-secondary' },
  PUBLICANDO: { label: 'Publicando…', cls: 'bg-amber-100 text-amber-700' },
  PUBLICADA:  { label: 'Publicada', cls: 'bg-green-100 text-green-700' },
  ERROR:      { label: 'Error', cls: 'bg-red-100 text-red-700' },
  CANCELADA:  { label: 'Cancelada', cls: 'bg-surface-high text-on-surface-variant' },
}

function IconoPlataforma({ plataforma, className }: { plataforma: Cuenta['plataforma']; className?: string }) {
  return plataforma === 'INSTAGRAM'
    ? <Instagram className={cn('text-pink-600', className)} />
    : <Facebook className={cn('text-blue-600', className)} />
}

function AvatarCuenta({ cuenta, size = 'w-9 h-9' }: { cuenta: Cuenta; size?: string }) {
  return (
    <span className={cn('rounded-full bg-primary-container flex items-center justify-center overflow-hidden shrink-0', size)}>
      {cuenta.fotoUrl
        ? <img src={cuenta.fotoUrl} alt="" className="w-full h-full object-cover" />
        : <IconoPlataforma plataforma={cuenta.plataforma} className="w-4 h-4" />}
    </span>
  )
}

// ── Configuración de la App de Meta (solo ADMIN) ─────────────────────────────

function SetupMeta({ onListo }: { onListo: () => void }) {
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [configId, setConfigId] = useState('')
  const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/marketing/redes/callback` : ''

  const guardar = useMutation({
    mutationFn: () => apiFetch('/redes/config', {
      method: 'POST',
      body: JSON.stringify({ appId: appId.trim(), appSecret: appSecret.trim(), configId: configId.trim() }),
    }),
    onSuccess: onListo,
  })

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h2 className="text-[15px] font-semibold text-on-surface">Configurar la conexión con Meta</h2>
      </div>
      <p className="text-[13px] text-on-surface-variant">
        Para publicar en Instagram y Facebook, la app necesita una <b>App de Meta</b>. Se crea una sola vez, gratis, en unos 10 minutos:
      </p>
      <ol className="text-[13px] text-on-surface-variant list-decimal pl-5 space-y-1.5">
        <li>Entra a <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">developers.facebook.com/apps</a> con la cuenta que administra las páginas de Grupo500 y crea una app: caso de uso <b>«Otro»</b> → tipo <b>«Negocios»</b>.</li>
      <li>En el panel de la app agrega el producto <b>«Inicio de sesión de Facebook para empresas»</b> (Facebook Login for Business).</li>
        <li>En <b>Inicio de sesión de Facebook → Configuración</b>, pega esta URI en «URI de redireccionamiento de OAuth válidos»:<br />
          <code className="block mt-1 px-2 py-1.5 bg-surface-high rounded-md text-[12px] text-on-surface break-all select-all">{redirectUri}</code>
        </li>
        <li>En <b>Inicio de sesión de Facebook para empresas → Configuraciones</b> crea una <b>Configuración</b> (tipo de token: <b>Token de acceso de usuario</b>) con los permisos: <code className="text-[11px]">pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, business_management</code>. Copia el <b>ID de configuración</b> — sin esto Meta rechaza los permisos con «Invalid Scopes».</li>
        <li>En <b>Configuración de la app → Información básica</b> copia el <b>Identificador de la app</b> y la <b>Clave secreta</b>, y pégalos abajo.</li>
        <li>Mientras la app esté «En desarrollo» solo pueden autorizar los administradores de la app — suficiente para las cuentas propias. Agrega como administradores en <b>Roles</b> a quienes vayan a vincular cuentas.</li>
      </ol>
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          value={appId}
          onChange={e => setAppId(e.target.value)}
          placeholder="App ID (numérico)"
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary"
        />
        <input
          value={appSecret}
          onChange={e => setAppSecret(e.target.value)}
          placeholder="App Secret"
          type="password"
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary"
        />
        <input
          value={configId}
          onChange={e => setConfigId(e.target.value)}
          placeholder="Config ID (Login para empresas)"
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary"
        />
      </div>
      {guardar.isError && <p className="text-[12px] text-negative">{(guardar.error as Error).message}</p>}
      <Button onClick={() => guardar.mutate()} disabled={!appId || !appSecret || guardar.isPending}>
        {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar credenciales'}
      </Button>
    </div>
  )
}

// ── Composer ─────────────────────────────────────────────────────────────────

function Composer({ cuentas, abierto, onClose }: { cuentas: Cuenta[]; abierto: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<Publicacion['tipo']>('POST')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaEsVideo, setMediaEsVideo] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorMedia, setErrorMedia] = useState('')
  const en1h = new Date(Date.now() + 60 * 60 * 1000)
  const [fecha, setFecha] = useState(format(en1h, 'yyyy-MM-dd'))
  const [hora, setHora] = useState(format(en1h, 'HH:mm'))

  const subirMedia = async (file: File) => {
    setSubiendo(true)
    setErrorMedia('')
    try {
      const esVideo = file.type.startsWith('video/')
      const token = await getClientToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/${esVideo ? 'video' : 'imagen'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Error al subir el archivo')
      setMediaUrl(json.data.url as string)
      setMediaEsVideo(esVideo)
    } catch (e) {
      setErrorMedia(e instanceof Error ? e.message : 'Error al subir el archivo')
    } finally {
      setSubiendo(false)
    }
  }

  const crear = useMutation({
    mutationFn: () => apiFetch('/redes/publicaciones', {
      method: 'POST',
      body: JSON.stringify({
        tipo,
        caption: caption.trim() || undefined,
        mediaUrl: mediaUrl ?? undefined,
        mediaEsVideo,
        programadaPara: new Date(`${fecha}T${hora}`).toISOString(),
        cuentaIds: seleccion,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['redes-publicaciones'] })
      setCaption(''); setMediaUrl(null); setMediaEsVideo(false); setSeleccion([])
      onClose()
    },
  })

  const necesitaVideo = tipo === 'REEL'
  const captionAplica = tipo !== 'HISTORIA'
  const listo = seleccion.length > 0 && !subiendo &&
    (tipo === 'POST' ? Boolean(mediaUrl || caption.trim()) : Boolean(mediaUrl)) &&
    (!necesitaVideo || mediaEsVideo)

  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Programar publicación" subtitulo="Se publicará automáticamente a la hora indicada" tono="marca">
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-outline-variant bg-surface-lowest p-1 gap-1">
          {(['POST', 'HISTORIA', 'REEL'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn(
                'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                tipo === t ? 'bg-primary text-surface-lowest' : 'text-on-surface-variant hover:bg-surface-high/60',
              )}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant mb-1.5">Cuentas</p>
          <div className="flex flex-wrap gap-2">
            {cuentas.map(c => {
              const activa = seleccion.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSeleccion(s => activa ? s.filter(x => x !== c.id) : [...s, c.id])}
                  className={cn(
                    'flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors',
                    activa ? 'border-primary bg-primary-container text-secondary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-high/60',
                  )}
                >
                  <AvatarCuenta cuenta={c} size="w-6 h-6" />
                  {c.nombre}
                </button>
              )
            })}
            {cuentas.length === 0 && <p className="text-[12px] text-on-surface-variant">No hay cuentas vinculadas todavía.</p>}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant mb-1.5">
            {tipo === 'REEL' ? 'Video' : 'Imagen o video'}
            {tipo === 'HISTORIA' && ' (vertical 9:16 recomendado)'}
          </p>
          <div className="flex items-center gap-3">
            <label className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-outline text-[12px] font-semibold cursor-pointer transition-colors',
              subiendo ? 'opacity-60 pointer-events-none' : 'hover:bg-surface-high/60 text-on-surface-variant',
            )}>
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : mediaEsVideo && mediaUrl ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              {subiendo ? 'Subiendo…' : mediaUrl ? 'Cambiar archivo' : 'Subir archivo'}
              <input
                type="file"
                accept={tipo === 'REEL' ? 'video/*' : 'image/*,video/*'}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void subirMedia(f) }}
              />
            </label>
            {mediaUrl && !mediaEsVideo && <img src={mediaUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-outline-variant" />}
            {mediaUrl && mediaEsVideo && <video src={mediaUrl} className="w-12 h-12 rounded-lg object-cover border border-outline-variant" muted />}
          </div>
          {errorMedia && <p className="text-[12px] text-negative mt-1">{errorMedia}</p>}
        </div>

        {captionAplica && (
          <div>
            <p className="text-[11px] font-semibold text-on-surface-variant mb-1.5">Texto</p>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              maxLength={2200}
              placeholder="Escribe el copy de la publicación…"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary resize-y"
            />
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold text-on-surface-variant mb-1.5">Fecha</p>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-on-surface-variant mb-1.5">Hora</p>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)}
              className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-[13px] text-on-surface outline-none focus:border-primary" />
          </div>
          <div className="flex-1" />
          <Button onClick={() => crear.mutate()} disabled={!listo || crear.isPending}>
            {crear.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Clock className="w-4 h-4 mr-1.5" />Programar</>}
          </Button>
        </div>
        {necesitaVideo && mediaUrl && !mediaEsVideo && <p className="text-[12px] text-negative">Un reel necesita un video, no una imagen.</p>}
        {crear.isError && <p className="text-[12px] text-negative">{(crear.error as Error).message}</p>}
      </div>
    </Modal>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function RedesPage() {
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === 'ADMIN'
  const qc = useQueryClient()
  const [composerAbierto, setComposerAbierto] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [mostrarSetup, setMostrarSetup] = useState(false)

  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ['redes-config'],
    queryFn: () => apiFetch<{ data: { configurada: boolean } }>('/redes/config'),
    staleTime: 60_000,
  })
  const configurada = config?.data.configurada ?? false

  const { data: cuentasData } = useQuery({
    queryKey: ['redes-cuentas'],
    queryFn: () => apiFetch<{ data: Cuenta[] }>('/redes/cuentas'),
  })
  const cuentas = cuentasData?.data ?? []

  const { data: pubsData, isLoading } = useQuery({
    queryKey: ['redes-publicaciones'],
    queryFn: () => apiFetch<{ data: Publicacion[] }>('/redes/publicaciones'),
    refetchInterval: 30_000,
  })
  const publicaciones = pubsData?.data ?? []
  const programadas = publicaciones.filter(p => p.estado === 'PROGRAMADA' || p.estado === 'PUBLICANDO')
    .sort((a, b) => +new Date(a.programadaPara) - +new Date(b.programadaPara))
  const historial = publicaciones.filter(p => p.estado === 'PUBLICADA' || p.estado === 'ERROR' || p.estado === 'CANCELADA')

  const conectar = async () => {
    setConectando(true)
    try {
      const redirectUri = `${window.location.origin}/marketing/redes/callback`
      const res = await apiFetch<{ data: { url: string } }>(`/redes/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`)
      window.location.href = res.data.url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error iniciando la conexión con Meta')
      setConectando(false)
    }
  }

  const accion = (fn: (id: string) => Promise<unknown>) => (id: string) =>
    fn(id).then(() => qc.invalidateQueries({ queryKey: ['redes-publicaciones'] }))
  const cancelar = accion(id => apiFetch(`/redes/publicaciones/${id}/cancelar`, { method: 'PATCH' }))
  const publicarAhora = accion(id => apiFetch(`/redes/publicaciones/${id}/ahora`, { method: 'POST' }))
  const eliminar = accion(id => apiFetch(`/redes/publicaciones/${id}`, { method: 'DELETE' }))
  const desvincular = (id: string) =>
    apiFetch(`/redes/cuentas/${id}`, { method: 'DELETE' }).then(() => qc.invalidateQueries({ queryKey: ['redes-cuentas'] }))

  const FilaPublicacion = ({ p }: { p: Publicacion }) => (
    <div className="flex items-center gap-3 px-5 py-3">
      {p.mediaUrl && !p.mediaEsVideo
        ? <img src={p.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-outline-variant shrink-0" />
        : <span className="w-10 h-10 rounded-lg bg-surface-high flex items-center justify-center shrink-0">
            {p.mediaEsVideo ? <Film className="w-4 h-4 text-on-surface-variant" /> : <ImageIcon className="w-4 h-4 text-on-surface-variant" />}
          </span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <IconoPlataforma plataforma={p.cuenta.plataforma} className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[13px] font-semibold text-on-surface truncate">{p.cuenta.nombre}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-high text-on-surface-variant">{TIPO_LABEL[p.tipo]}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', ESTADO_CHIP[p.estado].cls)}>{ESTADO_CHIP[p.estado].label}</span>
        </div>
        <p className="text-[12px] text-on-surface-variant truncate mt-0.5">
          {format(new Date(p.programadaPara), "EEE d 'de' MMM, h:mm a", { locale: es })}
          {p.caption ? ` · ${p.caption}` : ''}
        </p>
        {p.error && <p className="text-[11px] text-negative truncate">{p.error}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {(p.estado === 'PROGRAMADA' || p.estado === 'ERROR') && (
          <button title={p.estado === 'ERROR' ? 'Reintentar ahora' : 'Publicar ahora'} onClick={() => void publicarAhora(p.id)}
            className="p-2 rounded-lg hover:bg-surface-high/60 text-primary"><Send className="w-4 h-4" /></button>
        )}
        {p.estado === 'PROGRAMADA' && (
          <button title="Cancelar" onClick={() => void cancelar(p.id)}
            className="p-2 rounded-lg hover:bg-surface-high/60 text-on-surface-variant"><Ban className="w-4 h-4" /></button>
        )}
        {p.estado !== 'PROGRAMADA' && p.estado !== 'PUBLICANDO' && (
          <button title="Eliminar" onClick={() => void eliminar(p.id)}
            className="p-2 rounded-lg hover:bg-surface-high/60 text-negative"><Trash2 className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Redes"
        subtitle="Cuentas vinculadas y publicaciones programadas"
        actions={
          <>
            {configurada && esAdmin && (
              <Button variant="ghost" size="icon" title="Configuración de la App de Meta" onClick={() => setMostrarSetup(s => !s)}>
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
            {configurada && (
              <Button variant="outline" onClick={() => void conectar()} disabled={conectando}>
                {conectando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1.5" />Conectar con Meta</>}
              </Button>
            )}
            {cuentas.length > 0 && (
              <Button onClick={() => setComposerAbierto(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Programar
              </Button>
            )}
          </>
        }
      />

      {(!configurada || mostrarSetup) && (esAdmin
        ? <SetupMeta onListo={() => { setMostrarSetup(false); void refetchConfig() }} />
        : <div className="card text-[13px] text-on-surface-variant">Falta configurar la conexión con Meta — pídele al administrador que entre a esta pestaña.</div>
      )}

      {configurada && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold text-on-surface">Cuentas vinculadas</h2>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary-container text-secondary">{cuentas.length}</span>
          </div>
          {cuentas.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant px-5 pb-4">
              Ninguna todavía. Dale a <b>Conectar con Meta</b>, autoriza con la cuenta que administra las páginas, y las páginas de Facebook y sus Instagram profesionales quedan vinculados.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 px-5 pb-4">
              {cuentas.map(c => (
                <span key={c.id} className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-full border border-outline-variant text-[12px] font-semibold text-on-surface">
                  <AvatarCuenta cuenta={c} size="w-6 h-6" />
                  {c.nombre}
                  <IconoPlataforma plataforma={c.plataforma} className="w-3.5 h-3.5" />
                  {esAdmin && (
                    <button title="Desvincular" onClick={() => void desvincular(c.id)} className="p-0.5 rounded hover:bg-surface-high text-on-surface-variant">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="text-[15px] font-semibold text-on-surface">Próximas publicaciones</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : programadas.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant px-5 pb-4">Nada programado. Usa el botón <b>Programar</b> para crear la primera.</p>
        ) : (
          <div className="divide-y divide-outline-variant pb-1">{programadas.map(p => <FilaPublicacion key={p.id} p={p} />)}</div>
        )}
      </div>

      {historial.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <CheckCircle2 className="w-4 h-4 text-positive" />
            <h2 className="text-[15px] font-semibold text-on-surface">Historial</h2>
            {historial.some(p => p.estado === 'ERROR') && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700">
                <AlertCircle className="w-3 h-3" />{historial.filter(p => p.estado === 'ERROR').length} con error
              </span>
            )}
          </div>
          <div className="divide-y divide-outline-variant pb-1">{historial.slice(0, 30).map(p => <FilaPublicacion key={p.id} p={p} />)}</div>
        </div>
      )}

      <Composer cuentas={cuentas} abierto={composerAbierto} onClose={() => setComposerAbierto(false)} />
    </div>
  )
}
