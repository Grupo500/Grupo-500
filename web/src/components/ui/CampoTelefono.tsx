'use client'

/**
 * Un teléfono con su país.
 *
 * Guarda el número completo —`+57 3164134212`— y no solo la parte nacional:
 * con el país elegible, un número sin indicativo ya no se sabría de dónde es.
 * Los números viejos, que no traen `+`, se leen como colombianos, que es lo
 * que son.
 *
 * El selector de país es un panel propio (Radix Popover) y no un `<select>`
 * nativo: el nativo no puede mostrar banderas ni heredar el diseño de la app
 * — quedaba un menú azul del sistema, angosto y ajeno (feedback de Hotman,
 * 19-ago). Con 200 países, el panel trae buscador; en celular el teclado
 * filtra igual de rápido que la rueda del sistema.
 */

import { useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAISES, banderaDe, partirTelefono, unirTelefono, type Pais } from '@/lib/paises'

/**
 * La bandera como imagen y no como emoji: Windows no trae tipografía de
 * banderas, así que el emoji cae a las dos letras del país y se veía "CO",
 * "AF", "AL" en vez de banderas (Hotman, 20-ago). flagcdn.com ya está
 * permitido en la política de contenido de la app.
 *
 * Si la imagen no carga —sin conexión, o un ISO que el CDN no tenga— se
 * muestra el emoji, que en macOS y celular sí es una bandera de verdad y en
 * Windows al menos deja las dos letras.
 */
function Bandera({ iso, className }: { iso: string; className?: string }) {
  const [falló, setFalló] = useState(false)
  return (
    <span className={cn(
      'grid h-[15px] w-[21px] shrink-0 place-items-center overflow-hidden rounded-[3px] bg-surface-high text-[11px] leading-none ring-1 ring-black/10',
      className,
    )}>
      {falló ? banderaDe(iso) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
          srcSet={`https://flagcdn.com/w80/${iso.toLowerCase()}.png 2x`}
          alt=""
          loading="lazy"
          onError={() => setFalló(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  )
}

// Sin tildes y en minúsculas, para que "Peru" encuentre "Perú".
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function CampoTelefono({ valor, onCambio, placeholder = '316 413 4212' }: {
  /** El teléfono completo, como se guarda. */
  valor: string
  onCambio: (v: string) => void
  placeholder?: string
}) {
  const partido = useMemo(() => partirTelefono(valor), [valor])
  // El país vive aparte: si el número queda vacío, el país elegido no se puede
  // deducir de `valor` y se perdería mientras la persona escribe.
  const [pais, setPais] = useState<Pais>(partido.pais)
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const listaRef = useRef<HTMLDivElement>(null)

  const filtrados = useMemo(() => {
    const q = plano(busqueda.trim())
    if (!q) return PAISES
    return PAISES.filter(p => plano(p.nombre).includes(q) || p.indicativo.startsWith(q.replace('+', '')))
  }, [busqueda])

  const elegir = (p: Pais) => {
    setPais(p)
    onCambio(unirTelefono(p, partido.numero))
    setAbierto(false)
    setBusqueda('')
  }

  return (
    <div className="input-base flex items-center gap-0 p-0">
      <Popover.Root open={abierto} onOpenChange={o => { setAbierto(o); if (!o) setBusqueda('') }}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`País: ${pais.nombre} (+${pais.indicativo})`}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-l-lg border-r border-outline-variant py-2 pl-2.5 pr-2 text-sm text-on-surface-variant outline-none transition-colors hover:bg-surface-high focus-visible:bg-surface-high"
          >
            <Bandera iso={pais.iso} />
            +{pais.indicativo}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 opacity-60">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            collisionPadding={12}
            className="z-[10000] w-[280px] overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest shadow-float animate-fade-in"
            onOpenAutoFocus={e => {
              // El foco arranca en el buscador: con 200 países, se escribe, no se scrollea.
              e.preventDefault()
              ;(e.currentTarget as HTMLElement | null)?.querySelector('input')?.focus()
            }}
          >
            <div className="flex items-center gap-2 border-b border-outline-variant px-3 py-2">
              <Search className="size-3.5 shrink-0 text-on-surface-variant" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar país o indicativo"
                className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                onKeyDown={e => {
                  if (e.key === 'Enter' && filtrados.length > 0) elegir(filtrados[0])
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    listaRef.current?.querySelector('button')?.focus()
                  }
                }}
              />
            </div>

            <div ref={listaRef} className="max-h-[min(320px,50vh)] overflow-y-auto p-1">
              {filtrados.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-on-surface-variant">
                  Ningún país coincide con «{busqueda}»
                </p>
              )}
              {filtrados.map(p => (
                <button
                  key={p.iso}
                  type="button"
                  onClick={() => elegir(p)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-on-surface outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary',
                    p.iso === pais.iso && 'font-semibold',
                  )}
                >
                  <Bandera iso={p.iso} />
                  <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                  <span className="shrink-0 text-xs text-on-surface-variant tabular-nums">+{p.indicativo}</span>
                  {p.iso === pais.iso && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <input
        type="tel"
        value={partido.numero}
        onChange={e => onCambio(unirTelefono(pais, e.target.value))}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
      />
    </div>
  )
}
