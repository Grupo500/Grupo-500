'use client'

/**
 * Un teléfono colombiano, con su indicativo a la vista.
 *
 * El +57 se muestra pero NO se guarda: la app se lo antepone sola al armar los
 * enlaces de WhatsApp (`wa.me/57...`), así que guardarlo aquí produciría
 * números con el indicativo repetido. Lo que viaja al servidor sigue siendo el
 * número nacional de siempre.
 */

/**
 * La bandera dibujada y no el emoji 🇨🇴: Windows no trae los glifos de bandera
 * y los muestra como las dos letras del país, que se lee como un error.
 */
export function BanderaColombia() {
  return (
    <svg viewBox="0 0 6 4" className="h-3 w-[18px] shrink-0 rounded-[2px] ring-1 ring-black/10" aria-hidden>
      <rect width="6" height="2" y="0" fill="#FCD116" />
      <rect width="6" height="1" y="2" fill="#003893" />
      <rect width="6" height="1" y="3" fill="#CE1126" />
    </svg>
  )
}

export function CampoTelefono({ valor, onCambio, placeholder = '316 413 4212' }: {
  valor: string
  onCambio: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="input-base flex items-center gap-0 p-0">
      <span className="flex shrink-0 items-center gap-1.5 border-r border-outline-variant py-2 pl-3 pr-2.5 text-sm text-on-surface-variant">
        <BanderaColombia />
        +57
      </span>
      <input
        type="tel"
        value={valor}
        onChange={e => onCambio(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
      />
    </div>
  )
}
