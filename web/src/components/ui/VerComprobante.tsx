'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'

// Ícono de comprobante/recibo SVG limpio
function IconoRecibo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2h10a1 1 0 0 1 1 1v14l-2-1.5L12 17l-2-1.5L8 17l-2-1.5L4 17V3a1 1 0 0 1 1-1z"/>
      <line x1="7" y1="7" x2="13" y2="7"/>
      <line x1="7" y1="10" x2="13" y2="10"/>
      <line x1="7" y1="13" x2="10" y2="13"/>
    </svg>
  )
}
import { cn } from '@/lib/utils'

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [zoom, setZoom]     = useState(1)
  const esPDF               = /\.pdf($|\?)/i.test(url)
  const esImagen            = /\.(png|jpe?g|gif|webp|avif|heic)($|\?)/i.test(url)
  // Si no podemos determinar el tipo asumimos imagen (Cloudinary suele ser imagen)
  const mostrarImagen       = !esPDF || esImagen

  const cerrar = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={cerrar}
    >
      {/* Toolbar */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={e => e.stopPropagation()}
      >
        {mostrarImagen && (
          <>
            <button
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white text-xs font-mono w-10 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
              className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </>
        )}
        <a
          href={url}
          download
          onClick={e => e.stopPropagation()}
          className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Contenido */}
      <div
        className="flex items-center justify-center w-full h-full p-16 overflow-auto"
        onClick={cerrar}
      >
        {esPDF ? (
          <iframe
            src={url}
            className="w-full max-w-3xl h-[80vh] rounded-xl border-0 shadow-2xl"
            title="Comprobante PDF"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Comprobante de pago"
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain transition-transform duration-200 select-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            onClick={e => e.stopPropagation()}
            draggable={false}
          />
        )}
      </div>

      {/* Hint cerrar */}
      <p className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-white/40 select-none pointer-events-none">
        Clic fuera o ESC para cerrar
      </p>
    </div>
  )

  // Portal para salir del stack de z-index
  if (typeof window === 'undefined') return null
  return createPortal(content, document.body)
}

// ── Variantes de botón ────────────────────────────────────────────────────────
type Variante = 'link' | 'chip' | 'fila'

interface Props {
  url: string | null | undefined
  variante?: Variante
  label?: string
  className?: string
}

/**
 * VerComprobante — botón con lightbox integrado.
 * Reemplaza todos los <a href target="_blank"> de comprobantes.
 *
 * Variantes:
 *  - 'link'  → texto subrayado pequeño (por defecto)
 *  - 'chip'  → pastilla con ícono (para filas de cuota/pago)
 *  - 'fila'  → fila completa clicable (para panel de cobros)
 */
export function VerComprobante({ url, variante = 'link', label, className }: Props) {
  const [abierto, setAbierto] = useState(false)

  if (!url) return null

  const abrir = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setAbierto(true) }

  return (
    <>
      {variante === 'link' && (
        <button
          onClick={abrir}
          className={cn(
            'inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer',
            className,
          )}
        >
          <IconoRecibo className="w-3 h-3" />
          {label ?? 'Ver comprobante'}
        </button>
      )}

      {variante === 'chip' && (
        <button
          onClick={abrir}
          className={cn(
            'text-[10px] text-primary flex items-center gap-1 hover:underline cursor-pointer',
            className,
          )}
        >
          <IconoRecibo className="w-3 h-3" />Ver
        </button>
      )}

      {variante === 'fila' && (
        <button
          onClick={abrir}
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-high border border-outline-variant/40 hover:border-primary/30 transition-colors w-full text-left cursor-pointer',
            className,
          )}
        >
          <IconoRecibo className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm text-on-surface flex-1">{label ?? 'Ver comprobante'}</span>
        </button>
      )}

      {abierto && <Lightbox url={url} onClose={() => setAbierto(false)} />}
    </>
  )
}
