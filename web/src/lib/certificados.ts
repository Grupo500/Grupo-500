import { Clock, CheckCircle, type LucideIcon } from 'lucide-react'

export interface CursoEstudiante {
  curso: { nombre: string; duracionHoras: number; calendario: string; fechaInicio?: string | null; fechaFin?: string | null }
}
export interface Certificado {
  id: string
  tipo: 'CURSANDO' | 'COMPLETADO'
  numeroSerie: string
  fechaEmision: string
  archivoUrl: string
  estudiante: {
    nombre: string; email: string; telefono?: string
    tipoDocumento?: string; documento?: string; ciudad?: string
    colegio?: { nombre: string; ciudad: string } | null
    cursos?: CursoEstudiante[]
  }
}
export interface Firmas { firmaSebastian: string | null; firmaAndres: string | null }

export const TIPOS: Record<'CURSANDO' | 'COMPLETADO', { label: string; color: string; icon: LucideIcon }> = {
  CURSANDO:   { label: 'Cursando',   color: 'text-yellow-500 bg-yellow-400/10', icon: Clock },
  COMPLETADO: { label: 'Completado', color: 'text-secondary bg-secondary/10',   icon: CheckCircle },
}

// Horas por nombre de curso (fallback si el curso tiene 0 horas en BD).
// Misma regla que el backend: calendario 310h, intensivo 40h, combos suman,
// año 500 = 660h, premédico 100h.
export function horasPorNombreCurso(nombre: string): number {
  const n = (nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (n.includes('premedico') || n.includes('med500')) return 100
  if (n.includes('ano 500')) return 660
  if (n.includes('+') || n.includes('combo')) {
    let total = 0
    for (const p of n.split('+')) { if (p.includes('intensivo')) total += 40; else if (p.includes('calendario')) total += 310 }
    if (total > 0) return total
  }
  if (n.includes('intensivo')) return 40
  if (n.includes('calendario')) return 310
  return 0
}

export async function generarPDF(
  cert: Certificado,
  index: number,
  totalCerts: number,
  firmas: Firmas,
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { CertificadoTemplate } = await import('@/components/certificados/CertificadoTemplate')

  const e = cert.estudiante
  const cursoData = e.cursos?.[0]?.curso

  const tempDiv = document.createElement('div')
  tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(tempDiv)

  const root = createRoot(tempDiv)
  await new Promise<void>(resolve => {
    root.render(React.createElement(CertificadoTemplate, {
      data: {
        nombreEstudiante: e.nombre,
        tipoDocumento:    e.tipoDocumento ?? 'CC',
        documento:        e.documento ?? '',
        colegio:          e.colegio?.nombre ?? '',
        ciudadColegio:    e.colegio?.ciudad ?? e.ciudad ?? '',
        curso:            cursoData?.nombre ?? 'Preicfes',
        duracionHoras:    (cursoData?.duracionHoras && cursoData.duracionHoras > 0)
                            ? cursoData.duracionHoras
                            : horasPorNombreCurso(cursoData?.nombre ?? ''),
        fechaInicioCurso: cursoData?.fechaInicio ?? null,
        fechaFinCurso:    cursoData?.fechaFin    ?? null,
        tipo:             cert.tipo,
        fechaEmision:     cert.fechaEmision,
        numeroCertificado: totalCerts - index,
        firmaAndres:      firmas.firmaAndres    ?? undefined,
      },
    }))
    setTimeout(resolve, 400)
  })

  const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
  })

  root.unmount()
  document.body.removeChild(tempDiv)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
  pdf.save(`Certificado-${e.nombre.replace(/\s+/g, '-')}.pdf`)
}
