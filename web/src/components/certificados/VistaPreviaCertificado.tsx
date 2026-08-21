'use client'

/**
 * El certificado en miniatura, tal como va a salir impreso.
 *
 * No es un dibujo aproximado: es el mismo `CertificadoTemplate` que arma el
 * PDF, reducido con `scale`. Así la vista previa no puede mentir — si el
 * texto del certificado cambia, la miniatura cambia sola. La alternativa
 * (maquetar una miniatura aparte) se desincroniza al primer ajuste.
 *
 * Se carga con `next/dynamic` desde la pantalla del estudiante para que la
 * plantilla no entre en el bundle de quien nunca abre certificados.
 */

import { CertificadoTemplate, type CertificadoData } from './CertificadoTemplate'

/** Medidas de la hoja que dibuja la plantilla (A4 a 96dpi). */
const ANCHO_HOJA = 794
const ALTO_HOJA  = 1123

export function VistaPreviaCertificado({ data, ancho = 190 }: {
  data: CertificadoData
  /** Ancho final en píxeles; el alto sale de la proporción de la hoja. */
  ancho?: number
}) {
  const escala = ancho / ANCHO_HOJA

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-md bg-white shadow-[0_6px_20px_rgba(0,29,61,0.16)]"
      style={{ width: ancho, height: Math.round(ALTO_HOJA * escala) }}
    >
      <div
        style={{
          width: ANCHO_HOJA,
          height: ALTO_HOJA,
          transform: `scale(${escala})`,
          transformOrigin: 'top left',
        }}
      >
        <CertificadoTemplate data={data} />
      </div>
    </div>
  )
}
