'use client'

/**
 * La campana: el permiso del navegador y, ya resuelto, la bandeja.
 *
 * El botón no cambió de sitio ni de trabajo — sigue siendo el que pide permiso
 * para las notificaciones del navegador, y ese permiso hay que pedirlo desde un
 * gesto (iOS no lo concede de otra forma). Lo que cambia es que, una vez
 * contestado, el mismo botón abre la bandeja (Hotman, 20-ago).
 *
 * Si la persona dice que no, la bandeja sigue funcionando: los avisos se
 * guardan igual y lo único que se pierde es el globito del escritorio. Decir
 * que no a un permiso no debería dejar a nadie sin enterarse de que le
 * asignaron trabajo.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, BellRing, BellOff, Loader2, Check, Plus, Pencil } from 'lucide-react'
import { usePushNotificaciones } from '@/hooks/usePushNotificaciones'
import { getClientToken, createClientFetcher } from '@/lib/api'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'
import { cn } from '@/lib/utils'

type Tipo = 'TAREA_ASIGNADA' | 'CAMBIOS_PEDIDOS' | 'CORRECCION_HECHA' | 'TAREA_PUBLICADA'

interface Aviso {
  id: string
  tipo: Tipo
  texto: string
  url: string
  leidaEn: string | null
  createdAt: string
  autor?: { nombre: string | null; email: string; image: string | null } | null
}

/**
 * El punto de color sobre el avatar. Es lo que se lee antes que el texto:
 * azul te encargaron algo, rojo hay que rehacer, verde algo salió bien.
 */
const MARCA: Record<Tipo, { color: string; icono: typeof Plus }> = {
  TAREA_ASIGNADA:   { color: 'var(--primary)', icono: Plus },
  CAMBIOS_PEDIDOS:  { color: '#dc2626',        icono: Pencil },
  CORRECCION_HECHA: { color: '#16a34a',        icono: Check },
  TAREA_PUBLICADA:  { color: '#16a34a',        icono: Check },
}

/** "hace 4 minutos" mientras es reciente; después, la hora o el día. */
function cuando(iso: string) {
  const d = new Date(iso)
  const minutos = (Date.now() - d.getTime()) / 60000
  if (minutos < 60) return formatDistanceToNow(d, { locale: es, addSuffix: true })
  if (isToday(d)) return `hoy, ${format(d, 'h:mm a', { locale: es })}`
  if (isYesterday(d)) return `ayer, ${format(d, 'h:mm a', { locale: es })}`
  return format(d, "d 'de' MMM, h:mm a", { locale: es })
}

export function NotificacionesButton({ className, anillo = 'border-[#15203a]' }: {
  className?: string
  /** Color del anillo del globo de no leídas: iguala al fondo donde se para el botón. */
  anillo?: string
}) {
  const { estado, activar } = usePushNotificaciones()
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => fetcher<{ data: { avisos: Aviso[]; sinLeer: number } }>('/notificaciones'),
    // Se refresca sola por SSE al llegar una nueva; esto es el respaldo por si
    // la conexión se cayó sin avisar.
    refetchInterval: 2 * 60_000,
  })
  const avisos = data?.data?.avisos ?? []
  const sinLeer = data?.data?.sinLeer ?? 0

  const marcarTodas = useMutation({
    mutationFn: () => fetcher('/notificaciones/leidas', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  const marcarUna = useMutation({
    mutationFn: (id: string) => fetcher(`/notificaciones/${id}/leida`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  // Cerrar al hacer clic afuera o con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', esc)
    }
  }, [abierto])

  if (estado === 'no-soportado') return null

  const base = 'relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors'

  const alPulsar = async () => {
    // Primera vez: se pide el permiso, que es lo que este botón hacía antes.
    // Cuando se resuelve —conceda o no— la bandeja queda a un clic.
    if (estado === 'idle') { await activar(); setAbierto(true); return }
    setAbierto(a => !a)
  }

  const abrirAviso = (a: Aviso) => {
    if (!a.leidaEn) marcarUna.mutate(a.id)
    setAbierto(false)
    router.push(a.url)
  }

  return (
    <div ref={caja} className="relative">
      <button
        onClick={alPulsar}
        title={estado === 'denegado' ? 'Notificaciones — el aviso de escritorio está bloqueado' : 'Notificaciones'}
        aria-label="Notificaciones"
        aria-expanded={abierto}
        className={cn(
          base,
          'cursor-pointer',
          abierto
            ? 'bg-primary-container text-primary'
            : 'bg-surface-high text-on-surface-variant hover:bg-surface-highest hover:text-on-surface',
          className,
        )}
      >
        {estado === 'activando'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : estado === 'denegado'
            ? <BellOff className="w-4 h-4" />
            : estado === 'activo'
              ? <BellRing className="w-4 h-4" />
              : <Bell className="w-4 h-4" />}

        {sinLeer > 0 && (
          <span className={cn(
            'absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 bg-[#dc2626] px-1 text-[9.5px] font-bold tabular-nums leading-none text-white',
            anillo,
          )}>
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-[999] w-[352px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-outline-variant bg-surface-lowest shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
            <p className="text-[13.5px] font-semibold text-on-surface">Notificaciones</p>
            {sinLeer > 0 && (
              <button
                type="button"
                onClick={() => marcarTodas.mutate()}
                disabled={marcarTodas.isPending}
                className="shrink-0 cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* El push no se pide dos veces con el mismo botón: si falta, se
              ofrece aquí, donde ya se está mirando lo que uno se pierde. */}
          {estado === 'idle' && (
            <div className="flex items-center gap-2.5 border-b border-outline-variant bg-surface-low px-4 py-2.5">
              <Bell className="size-[15px] shrink-0 text-primary" />
              <p className="flex-1 text-[11.5px] leading-snug text-on-surface-variant">
                Activa el aviso en el escritorio para enterarte sin entrar.
              </p>
              <button
                type="button"
                onClick={() => activar()}
                className="shrink-0 cursor-pointer rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-on transition-[filter] hover:brightness-110"
              >
                Activar
              </button>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            {avisos.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-on-surface-variant">
                Nada por ahora. Aquí llegan los trabajos que te asignen y las
                correcciones que te pidan.
              </p>
            ) : (
              avisos.map(a => {
                const marca = MARCA[a.tipo]
                const Icono = marca.icono
                const nombre = a.autor?.nombre ?? 'Alguien'
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => abrirAviso(a)}
                    className={cn(
                      'relative flex w-full cursor-pointer gap-3 border-b border-outline-variant px-4 py-3 pr-7 text-left transition-colors last:border-b-0',
                      a.leidaEn
                        ? 'hover:bg-surface-low'
                        : 'bg-primary/[0.06] hover:bg-primary/[0.11]',
                    )}
                  >
                    <span className="relative size-8 shrink-0">
                      <AvatarMiembro
                        id={a.autor?.email ?? a.id}
                        nombre={nombre}
                        image={a.autor?.image}
                        size={32}
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-surface-lowest"
                        style={{ background: marca.color }}
                      >
                        <Icono className="size-2 text-white" strokeWidth={3.5} />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] leading-snug text-on-surface">
                        {a.texto}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-on-surface-variant first-letter:uppercase">
                        {cuando(a.createdAt)}
                      </span>
                    </span>

                    {!a.leidaEn && (
                      <span className="absolute right-3 top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
