'use client'

/**
 * Un teléfono con su país.
 *
 * Guarda el número completo —`+57 3164134212`— y no solo la parte nacional:
 * con el país elegible, un número sin indicativo ya no se sabría de dónde es.
 * Los números viejos, que no traen `+`, se leen como colombianos, que es lo
 * que son.
 *
 * El selector es un `<select>` nativo a propósito: en celular abre la rueda
 * del sistema, que se recorre con el pulgar mucho mejor que cualquier lista
 * que se pueda dibujar, y trae gratis la búsqueda escribiendo.
 */

import { useMemo, useState } from 'react'
import { PAISES, banderaDe, partirTelefono, unirTelefono, type Pais } from '@/lib/paises'

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

  const cambiarPais = (iso: string) => {
    const nuevo = PAISES.find(p => p.iso === iso) ?? pais
    setPais(nuevo)
    onCambio(unirTelefono(nuevo, partido.numero))
  }

  return (
    <div className="input-base flex items-center gap-0 p-0">
      <div className="relative flex shrink-0 items-center gap-1.5 border-r border-outline-variant py-2 pl-2.5 pr-2 text-sm text-on-surface-variant">
        {/* La bandera en una cajita: en Windows el emoji cae a las dos letras
            del país, y con fondo eso se lee como insignia y no como un glifo
            roto. */}
        <span className="grid h-[15px] w-[21px] place-items-center overflow-hidden rounded-[3px] bg-surface-high text-[12px] leading-none ring-1 ring-black/10">
          {banderaDe(pais.iso)}
        </span>
        +{pais.indicativo}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 opacity-60">
          <path d="m6 9 6 6 6-6" />
        </svg>
        {/* El select real, invisible encima: conserva el menú nativo del
            sistema sin heredar su caja, que no se puede estilar. */}
        <select
          value={pais.iso}
          onChange={e => cambiarPais(e.target.value)}
          aria-label="País"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {PAISES.map(p => (
            <option key={p.iso} value={p.iso}>{p.nombre} (+{p.indicativo})</option>
          ))}
        </select>
      </div>

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
