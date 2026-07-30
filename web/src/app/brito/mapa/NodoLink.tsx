'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { OverlaySendero, DURACION, MINIMO } from '../TransicionSendero'

/**
 * Enlace de un nodo de lección en el mapa. Al presionar muestra la misma
 * pantalla de carga del sendero que la portada, con mensaje propio, y navega
 * cuando el trazo termina.
 */
export function NodoLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const [montado, setMontado] = useState(false)

  // El portal necesita `document`, que no existe al renderizar en el servidor.
  useEffect(() => setMontado(true), [])
  useEffect(() => { router.prefetch(href) }, [router, href])

  useEffect(() => {
    if (!corriendo) return
    const salto = setTimeout(() => router.push(href), Math.max(DURACION, MINIMO))
    return () => clearTimeout(salto)
  }, [corriendo, router, href])

  function clic(e: React.MouseEvent) {
    e.preventDefault()
    if (corriendo) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push(href)
      return
    }
    setCorriendo(true)
  }

  return (
    <>
      <a href={href} onClick={clic}>{children}</a>
      {corriendo && montado && createPortal(
        <OverlaySendero mensaje="Preparando tu lección" />,
        document.body,
      )}
    </>
  )
}
