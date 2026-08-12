'use client'

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  className?: string
}

/**
 * Diálogo centrado genérico — mismo mecanismo que el Lightbox de
 * VerComprobante (portal a document.body, ESC, clic afuera, scroll del body
 * bloqueado), pero como tarjeta de contenido en vez de visor de imagen.
 */
export function Modal({ abierto, onClose, titulo, subtitulo, children, pie, className }: Props) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={cerrarPorFondo}
    >
      <div
        className={cn(
          'w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-surface-lowest sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up',
          className,
        )}
      >
        {/* items-center y no items-start: alineados por arriba, el título de
            15px queda unos 6px más alto que el centro del botón de cerrar, que
            es un círculo de 32px, y se lee como si estuvieran en filas
            distintas. */}
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-outline-variant shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-on-surface">{titulo}</h2>
            {subtitulo && <p className="text-[12px] text-on-surface-variant mt-0.5">{subtitulo}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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
