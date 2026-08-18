'use client'

import { useState, useTransition } from 'react'
import { FolderPlus, Loader2 } from 'lucide-react'
import { crearDepartamento } from '../acciones'

// Paletas e íconos de la app original de pagos de agencia
const COLORES = [
  { n: 'Azul', g: '#1257C4,#8FD0FF' }, { n: 'Morado', g: '#6A3AA6,#C79BF0' },
  { n: 'Coral', g: '#B0452C,#FFB08A' }, { n: 'Verde', g: '#0F6E5C,#5DD9B8' },
  { n: 'Océano', g: '#144E7A,#57A8D8' }, { n: 'Dorado', g: '#9A5A10,#FFD08A' },
  { n: 'Índigo', g: '#2C4C9B,#9AB8FF' }, { n: 'Rosa', g: '#9B2C5A,#FF9AC4' },
  { n: 'Turquesa', g: '#0B6675,#67DDE8' }, { n: 'Vino', g: '#7A1F3D,#E88AA6' },
]
const ICONOS = [
  { k: 'estrella', p: '<path d="m12 3.4 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.9l6.1-.9L12 3.4Z"/>' },
  { k: 'rayo', p: '<path d="M13.2 2.6 4.6 13.4h6l-1.8 8 8.6-10.8h-6l1.8-8Z"/>' },
  { k: 'cohete', p: '<path d="M12 2.6c3.4 2.4 5.4 6.2 5.4 10.4l-2.2 3.4H8.8l-2.2-3.4C6.6 8.8 8.6 5 12 2.6Z"/><circle cx="12" cy="10" r="2.1"/><path d="M8.8 16.4 6.4 21l4-1.4M15.2 16.4 17.6 21l-4-1.4"/>' },
  { k: 'corazón', p: '<path d="M12 20.4S3.6 15.2 3.6 9.6a4.6 4.6 0 0 1 8.4-2.6 4.6 4.6 0 0 1 8.4 2.6c0 5.6-8.4 10.8-8.4 10.8Z"/>' },
  { k: 'libro', p: '<path d="M4 4.4h5.4A2.6 2.6 0 0 1 12 7v12.6a2 2 0 0 0-2-2H4V4.4Z"/><path d="M20 4.4h-5.4A2.6 2.6 0 0 0 12 7v12.6a2 2 0 0 1 2-2h6V4.4Z"/>' },
  { k: 'maletín', p: '<rect x="2.8" y="7.4" width="18.4" height="12.2" rx="2.4"/><path d="M8.6 7.4V5.8a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.6"/><path d="M2.8 12.6h18.4"/>' },
  { k: 'bombillo', p: '<path d="M9.4 17.4a6.2 6.2 0 1 1 5.2 0"/><path d="M9.6 20.2h4.8M10.2 22.4h3.6"/><path d="M9.4 17.4h5.2"/>' },
  { k: 'música', p: '<circle cx="7" cy="17.6" r="2.8"/><circle cx="18" cy="15.4" r="2.6"/><path d="M9.8 17.6V6.4l10.8-2.2v11.2"/>' },
  { k: 'globo', p: '<circle cx="12" cy="12" r="9"/><path d="M3.2 12h17.6"/><path d="M12 3a13.6 13.6 0 0 1 0 18 13.6 13.6 0 0 1 0-18Z"/>' },
  { k: 'engranaje', p: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.8M12 18.6v2.8M21.4 12h-2.8M5.4 12H2.6M18.6 5.4l-2 2M7.4 16.6l-2 2M18.6 18.6l-2-2M7.4 7.4l-2-2"/>' },
]

export default function FormDepartamento() {
  const [abierto, setAbierto] = useState(false)
  const [color, setColor] = useState(COLORES[0].g)
  const [icono, setIcono] = useState(ICONOS[0].p)
  const [error, setError] = useState('')
  const [pendiente, startTransition] = useTransition()

  const enviar = (fd: FormData) => {
    setError('')
    startTransition(async () => {
      const r = await crearDepartamento({
        nombre: String(fd.get('nombre') ?? ''),
        gradiente: color,
        icono,
      })
      if (r.error) setError(r.error)
      else setAbierto(false)
    })
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
        <FolderPlus className="w-3.5 h-3.5" /> Crear departamento
      </button>
    )
  }

  return (
    <form action={enviar} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 space-y-3 max-w-xl">
      <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
        <FolderPlus className="w-4 h-4 text-primary" /> Nuevo departamento
      </p>
      <input name="nombre" required placeholder="Nombre (ej. Comunidad y redes)"
        className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/60" />

      <div>
        <p className="text-xs text-on-surface-variant mb-1.5">Color</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLORES.map(c => (
            <button key={c.g} type="button" title={c.n} onClick={() => setColor(c.g)}
              className={`w-8 h-8 rounded-lg transition-transform ${color === c.g ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''}`}
              style={{ background: `linear-gradient(150deg, ${c.g})` }} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-on-surface-variant mb-1.5">Ícono</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ICONOS.map(i => (
            <button key={i.k} type="button" title={i.k} onClick={() => setIcono(i.p)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${icono === i.p ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''}`}
              style={{ background: `linear-gradient(150deg, ${color})` }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="1.55"
                strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: i.p }} />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pendiente}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-60">
          {pendiente && <Loader2 className="w-3 h-3 animate-spin" />} Crear
        </button>
        <button type="button" onClick={() => setAbierto(false)}
          className="px-3.5 py-2 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant">
          Cancelar
        </button>
      </div>
    </form>
  )
}
