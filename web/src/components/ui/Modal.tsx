'use client'

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// El mismo azul marino del header y del sidebar. Está repetido a propósito en
// las tres piezas de chrome: no es un token de tema porque no cambia con él.
const RAIL_BG = '#15203a'

interface Props {
  abierto: boolean
  onClose: () => void
  titulo: string
  subtitulo?: string
  children: React.ReactNode
  /**
   * Acciones del diálogo. Van aquí y no dentro de `children` por dos razones:
   * su línea divisoria cruza la tarjeta de borde a borde igual que la del
   * encabezado —dentro del cuerpo quedaría metida el ancho del padding— y los
   * botones no se van con el scroll cuando el formulario es largo.
   */
  pie?: React.ReactNode
  /**
   * Azul para actuar, claro para consultar.
   *
   * La franja de marca nació para los formularios, donde la ventana es un
   * objeto con una acción y el azul se lee como su barra de título. En una
   * ventana de consulta —una lista de tarjetas con sus propios colores— el
   * marco termina pesando más que lo que contiene: tres fondos apilados en los
   * primeros 120px y el ojo reanclándose antes de llegar al primer dato.
   */
  tono?: 'claro' | 'marca'
  /** A la derecha del título. Para la cifra que resume lo que se está viendo. */
  extra?: React.ReactNode
  className?: string
}

/**
 * Diálogo centrado genérico — mismo mecanismo que el Lightbox de
 * VerComprobante (portal a document.body, ESC, clic afuera, scroll del body
 * bloqueado), pero como tarjeta de contenido en vez de visor de imagen.
 */
export function Modal({
  abierto, onClose, titulo, subtitulo, children, pie,
  tono = 'claro', extra, className,
}: Props) {
  const cerrarPorFondo = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    if (!abierto) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [abierto, onClose])

  if (!abierto || typeof window === 'undefined') return null

  const marca = tono === 'marca'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={cerrarPorFondo}
    >
      <div
        className={cn(
          // `overflow-hidden` porque el encabezado va con fondo propio: sin
          // recortar, su color se saldría por las esquinas redondeadas.
          'w-full sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden bg-surface-lowest sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up',
          className,
        )}
      >
        {/* En 'marca', la misma franja azul marino del header, el sidebar y la
            barra flotante; no sigue el tema de la app, igual que ellos, porque
            es chrome y no contenido. En 'claro', el encabezado es la propia
            tarjeta y solo lo separa una línea.

            items-center y no items-start: alineados por arriba, el título de
            15px queda unos 6px más alto que el centro del botón de cerrar, que
            es un círculo de 32px, y se lee como si estuvieran en filas
            distintas. */}
        <div
          style={marca ? { background: RAIL_BG } : undefined}
          className={cn(
            'flex items-center justify-between gap-3 px-5 py-4 shrink-0',
            !marca && 'border-b border-outline-variant',
          )}
        >
          <div className="min-w-0">
            <h2 className={cn('text-[15px] font-semibold', marca ? 'text-white' : 'text-on-surface')}>
              {titulo}
            </h2>
            {subtitulo && (
              <p className={cn('text-[12px] mt-0.5', marca ? 'text-slate-400' : 'text-on-surface-variant')}>
                {subtitulo}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {extra}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0',
                marca
                  ? 'text-[#c3d4ee] hover:bg-white/[0.14] hover:text-white'
                  : 'text-on-surface-variant bg-surface-high hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-2">{children}</div>
        {pie && (
          <div className="shrink-0 border-t border-outline-variant px-5 py-3.5">{pie}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
