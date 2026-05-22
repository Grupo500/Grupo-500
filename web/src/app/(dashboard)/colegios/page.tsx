'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import {
  School, Plus, X, Loader2, MapPin, Users,
  Handshake, User, Calendar, ChevronRight, Search,
  Eye, Mail, Phone, FileText, Download, MessageCircle, Send,
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────────────────────────────
interface Colegio {
  id: string
  nombre: string
  ciudad: string
  contactoNombre?: string
  contactoEmail?: string
  contactoTelefono?: string
  _count?: { estudiantes: number }
}

type Etapa =
  | 'PROSPECTO' | 'CONTACTO' | 'PROPUESTA'
  | 'REUNION' | 'CONVENIO' | 'DESCARTADO'

interface Negociacion {
  id: string
  etapa: Etapa
  notas?: string
  fechaContacto?: string
  fechaReunion?: string
  fechaProxContacto?: string
  updatedAt: string
  colegio: { id: string; nombre: string; ciudad: string }
  asesor:  { id: string; nombre: string }
}

// ── Config pipeline ────────────────────────────────────────────────────────
const ETAPAS: {
  etapa: Etapa
  label: string
  labelCorto: string
  color: string
  bg: string
  bgActive: string
  border: string
  dot: string
  textActive: string
}[] = [
  { etapa: 'PROSPECTO',  label: 'Prospecto',  labelCorto: 'Prospecto',  color: 'text-slate-500',  bg: 'bg-slate-100',   bgActive: 'bg-slate-500',   border: 'border-slate-300',  dot: 'bg-slate-400',   textActive: 'text-white' },
  { etapa: 'CONTACTO',   label: 'Contacto',   labelCorto: 'Contacto',   color: 'text-blue-500',   bg: 'bg-blue-50',     bgActive: 'bg-blue-500',    border: 'border-blue-200',   dot: 'bg-blue-400',    textActive: 'text-white' },
  { etapa: 'PROPUESTA',  label: 'Propuesta',  labelCorto: 'Propuesta',  color: 'text-amber-500',  bg: 'bg-amber-50',    bgActive: 'bg-amber-500',   border: 'border-amber-200',  dot: 'bg-amber-400',   textActive: 'text-white' },
  { etapa: 'REUNION',    label: 'Reunión',    labelCorto: 'Reunión',    color: 'text-violet-500', bg: 'bg-violet-50',   bgActive: 'bg-violet-500',  border: 'border-violet-200', dot: 'bg-violet-400',  textActive: 'text-white' },
  { etapa: 'CONVENIO',   label: 'Convenio',   labelCorto: 'Convenio',   color: 'text-green-500',  bg: 'bg-green-50',    bgActive: 'bg-green-500',   border: 'border-green-200',  dot: 'bg-green-400',   textActive: 'text-white' },
  { etapa: 'DESCARTADO', label: 'Descartado', labelCorto: 'Descartado', color: 'text-red-400',    bg: 'bg-red-50',      bgActive: 'bg-red-400',     border: 'border-red-200',    dot: 'bg-red-400',     textActive: 'text-white' },
]

// ── Modal genérico ─────────────────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de negociación ─────────────────────────────────────────────────
function NegCard({ neg, onClick }: { neg: Negociacion; onClick: () => void }) {
  const cfg = ETAPAS.find(e => e.etapa === neg.etapa)!
  return (
    <div
      onClick={onClick}
      className="bg-surface-lowest border border-outline-variant rounded-xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[13px] font-semibold text-on-surface leading-snug">{neg.colegio.nombre}</p>
        <ChevronRight className="w-4 h-4 text-on-surface-variant opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <MapPin className="w-3 h-3 flex-shrink-0" />{neg.colegio.ciudad}
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <User className="w-3 h-3 flex-shrink-0" />{neg.asesor.nombre}
        </div>
        {neg.fechaProxContacto && (
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            Próx: {formatDate(neg.fechaProxContacto)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          {cfg.labelCorto}
        </span>
        <span className="text-[10px] text-on-surface-variant">{formatDate(neg.updatedAt)}</span>
      </div>
    </div>
  )
}

// ── Modal estudiantes de un colegio ───────────────────────────────────────
function EstudiantesColegioModal({
  colegio,
  onClose,
  fetcher,
}: {
  colegio: Colegio
  onClose: () => void
  fetcher: <T>(path: string) => Promise<T>
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes-colegio', colegio.id],
    queryFn: () => fetcher<any>(`/estudiantes?colegioId=${colegio.id}&limit=100`),
  })

  const estudiantes: any[] = data?.data ?? []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-lg max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <School className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-on-surface">{colegio.nombre}</h2>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{colegio.ciudad}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : estudiantes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <Users className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sin estudiantes registrados</p>
                <p className="text-xs opacity-60 mt-1">Ningún estudiante tiene este colegio asignado</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  {estudiantes.length} estudiante{estudiantes.length !== 1 ? 's' : ''}
                </p>
                {estudiantes.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-3 bg-surface-low border border-outline-variant/60 rounded-xl px-4 py-3 hover:border-primary/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{e.nombre[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{e.nombre}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                          <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate max-w-[140px]">{e.email}</span>
                        </span>
                        {e.telefono && (
                          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                            <Phone className="w-3 h-3 flex-shrink-0" />{e.telefono}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.asesor && (
                      <span className="text-[10px] text-on-surface-variant opacity-60 hidden sm:block">{e.asesor.nombre}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Generador de propuesta institucional ──────────────────────────────────
const TABLA_CURSOS = [
  { curso: 'Preicfes Calendario A 2026\n(Inició el 18 de abril y finaliza el 25 de julio de 2026)', precio: 600000, precioDesc: 540000 },
  { curso: 'Preicfes Calendario A 2026 + Intensivo A\n(Calendario A + un curso intensivo de 40 horas)', precio: 1000000, precioDesc: 900000 },
  { curso: 'Preicfes Intensivo A\n(Curso intensivo de 40 horas: Inicia el 27 de junio y termina el 25 de julio)', precio: 500000, precioDesc: 450000 },
  { curso: 'Combo Preicfes Calendario A + Calendario G\n(Inicia en abril y finaliza en diciembre de 2026)', precio: 1000000, precioDesc: 900000 },
  { curso: 'Preicfes Calendario G 2026\n(Inicia en octubre y finaliza en diciembre 20 de 2026)', precio: 650000, precioDesc: 585000 },
  { curso: 'Año500\n(Curso Calendario A + Intensivo A + Calendario G)', precio: 1600000, precioDesc: 1440000 },
  { curso: 'Premédico + Cal A o Cal G 2026\n(Curso Premédico para aspirantes a carreras del área de la salud + Calendario A o G)', precio: 900000, precioDesc: 810000 },
]

function formatCOP(n: number) {
  return '$' + n.toLocaleString('es-CO')
}

function PropuestaModal({ colegio, onClose, onEditarColegio }: { colegio: Colegio; onClose: () => void; onEditarColegio: (c: Colegio) => void }) {
  const [sending, setSending] = useState(false)
  const today = new Date()
  const fechaStr = today.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  async function generarPDF(descargar = true): Promise<Uint8Array> {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const W  = 210
    const H  = 297
    const ml = 22   // margen izquierdo
    const mr = 22   // margen derecho
    const cw = W - ml - mr
    const lh = 5.2  // interlineado base

    // ── Colores exactos del DOCX ──────────────────────────────────────────
    const NAVY  = [23,  54,  93]  as [number,number,number]   // #17365D
    const BLUE  = [0,  176, 240]  as [number,number,number]   // #00B0F0
    const WHITE = [255,255,255]   as [number,number,number]
    const BLACK = [0,   0,   0]   as [number,number,number]
    const DARK  = [31,  73, 125]  as [number,number,number]   // #1F497D (texto azul oscuro)

    // ── Cargar recursos en base64 ─────────────────────────────────────────
    async function loadBase64(url: string): Promise<string> {
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin = ''
      bytes.forEach(b => bin += String.fromCharCode(b))
      return btoa(bin)
    }
    async function loadImageBase64(url: string): Promise<string> {
      const res = await fetch(url)
      const blob = await res.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }

    const [fondoB64, waB64, aptosReg, aptosBold, aptosIt, aptosBoldIt] = await Promise.all([
      loadImageBase64('/propuesta/fondo.jpg').catch(() => ''),
      loadImageBase64('/propuesta/whatsapp.png').catch(() => ''),
      loadBase64('/propuesta/Aptos.ttf').catch(() => ''),
      loadBase64('/propuesta/Aptos-Bold.ttf').catch(() => ''),
      loadBase64('/propuesta/Aptos-Italic.ttf').catch(() => ''),
      loadBase64('/propuesta/Aptos-BoldItalic.ttf').catch(() => ''),
    ])

    // Registrar Aptos en jsPDF (subsetted con fonttools — tablas normalizadas)
    if (aptosReg) {
      doc.addFileToVFS('Aptos.ttf',            aptosReg)
      doc.addFileToVFS('Aptos-Bold.ttf',       aptosBold)
      doc.addFileToVFS('Aptos-Italic.ttf',     aptosIt)
      doc.addFileToVFS('Aptos-BoldItalic.ttf', aptosBoldIt)
      doc.addFont('Aptos.ttf',            'Aptos', 'normal')
      doc.addFont('Aptos-Bold.ttf',       'Aptos', 'bold')
      doc.addFont('Aptos-Italic.ttf',     'Aptos', 'italic')
      doc.addFont('Aptos-BoldItalic.ttf', 'Aptos', 'bolditalic')
    }
    const FONT = aptosReg ? 'Aptos' : 'helvetica'

    // ── Helper: agregar fondo a la página actual ──────────────────────────
    function addBackground() {
      if (fondoB64) {
        doc.addImage(fondoB64, 'JPEG', 0, 0, W, H)
      }
    }

    // ── Helper: texto ─────────────────────────────────────────────────────
    function txt(text: string | string[], x: number, yy: number, opts?: Parameters<typeof doc.text>[3]) {
      doc.setTextColor(...BLACK)
      doc.text(text as string, x, yy, opts)
    }

    // ── Helper: nueva página con fondo ────────────────────────────────────
    function newPage(): number {
      doc.addPage()
      addBackground()
      return 52  // y inicial en páginas 2+
    }

    // ── PÁGINA 1 ──────────────────────────────────────────────────────────
    addBackground()
    let y = 52   // inicia bajo el header del fondo

    // Municipio y fecha
    doc.setFont(FONT, 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(`${colegio.ciudad}, ${fechaStr}`, ml, y)
    y += lh * 2.5

    // Nombre institución — 30pt bold negro
    doc.setFont(FONT, 'bold')
    doc.setFontSize(30)
    doc.setTextColor(...BLACK)
    const nombreLines = doc.splitTextToSize(colegio.nombre.toUpperCase(), cw)
    doc.text(nombreLines, ml, y)
    y += nombreLines.length * 11 + lh * 1.5

    // ASUNTO — caja con borde negro, texto centrado
    doc.setFont(FONT, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    const asuntoText = 'ASUNTO. PRESENTACIÓN DEL PROGRAMA ALIADOS 500'
    const asuntoH = lh + 8   // altura fija del rectángulo
    doc.setDrawColor(...BLACK); doc.setLineWidth(0.5)
    doc.rect(ml, y - 5, cw, asuntoH)
    // Centrar texto vertical y horizontalmente dentro del rect
    doc.text(asuntoText, ml + cw / 2, y - 5 + asuntoH / 2 + 1.5, { align: 'center' })
    y += asuntoH + lh * 1.2

    // Saludo
    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    const saludo = colegio.contactoNombre
      ? `Cordial saludo ${colegio.contactoNombre} y padres de familia,`
      : 'Cordial saludo y padres de familia,'
    const saludoLines = doc.splitTextToSize(saludo, cw)
    doc.text(saludoLines, ml, y); y += saludoLines.length * lh + lh * 1.5

    // Intro
    const intro = 'GRUPO 500 EDUCACIÓN S.A.S., sociedad legalmente constituida e identificada con NIT No. 901.768.155-8, representada legalmente por el señor Andrés Felipe Díaz Rivero, identificado con cédula de ciudadanía No. 1.005.480.173 de San Gil, se permite saludarlos muy respetuosamente. La presente comunicación tiene como propósito poner en su conocimiento el programa ALIADOS 500, una iniciativa que ofrece múltiples beneficios no solo para la Institución Educativa, sino también para sus estudiantes y sus familias.'
    const introLines = doc.splitTextToSize(intro, cw)
    doc.text(introLines, ml, y); y += introLines.length * lh + lh

    // A. Sobre GRUPO 500
    if (y > 240) { y = newPage() }
    doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    doc.text('A. Sobre GRUPO 500 EDUCACION S.A.S', ml, y); y += lh * 1.8

    const bloques = [
      'GRUPO 500 EDUCACIÓN S.A.S. es una empresa comprometida con la excelencia académica y con la formación integral de los jóvenes. A lo largo de los años, hemos acompañado a más de 25.000 estudiantes en su proceso de preparación para el examen ICFES, consolidándonos como uno de los programas Preicfes mejor posicionados en Colombia. Nos enorgullece destacar que, a la fecha, cinco de nuestros estudiantes han obtenido el puntaje perfecto: 500/500.',
      'El programa Preicfes de GRUPO 500 EDUCACIÓN S.A.S. se ha diseñado cuidadosamente para responder a las exigencias actuales del examen Saber 11. Cada uno de sus componentes busca desarrollar las competencias necesarias en las áreas evaluadas, fortaleciendo tanto el conocimiento disciplinar como las habilidades críticas, analíticas y comunicativas de los estudiantes.',
      'En primer lugar, brindamos clases 100% en vivo virtuales, impartidas por un equipo de docentes expertos con amplia experiencia en la enseñanza y en la preparación para pruebas estandarizadas. A lo largo de más de 310 horas de formación, los jóvenes trabajan bajo un enfoque pedagógico dinámico, centrado en la resolución de problemas, el análisis de situaciones reales y la práctica constante.',
      'Todas las sesiones quedan grabadas y disponibles para consulta hasta la finalización del calendario. Asimismo, los estudiantes cuentan con material digital actualizado conforme a los lineamientos del ICFES, cuatro (4) simulacros oficiales con informes personalizados de desempeño, tutorías personalizadas y seguimiento académico permanente por WhatsApp, y horarios flexibles en tres calendarios: B, A y G.',
    ]
    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    for (const b of bloques) {
      if (y > 250) { y = newPage() }
      const ls = doc.splitTextToSize(b, cw)
      doc.text(ls, ml, y); y += ls.length * lh + lh * 0.6
    }

    // Horarios (bullets)
    if (y > 245) { y = newPage() }
    const horarios = [
      '• Calendario B (17 de enero al 14 de marzo de 2026): Lunes a viernes 4:00 p.m.–8:00 p.m.; sábados 8:00 a.m.–6:00 p.m.',
      '• Calendario A (18 de abril al 25 de julio de 2026): Lunes a viernes 6:00 p.m.–8:00 p.m.; sábados 8:00 a.m.–6:00 p.m.',
      '• Calendario G (octubre al 20 de diciembre de 2026): Lunes a viernes 4:00 p.m.–8:00 p.m.; sábados 8:00 a.m.–6:00 p.m.',
    ]
    doc.setTextColor(...DARK)
    for (const h of horarios) {
      const ls = doc.splitTextToSize(h, cw - 5)
      doc.text(ls, ml + 3, y); y += ls.length * lh + lh * 0.3
    }
    y += lh * 0.7

    // ── B. Oferta ─────────────────────────────────────────────────────────
    if (y > 235) { y = newPage() }
    doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    doc.text('B. Oferta', ml, y); y += lh * 1.8

    doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    doc.text('1. Beneficios para los estudiantes de la Institución Educativa', ml, y); y += lh * 1.8

    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    const textoBeneficios = 'En el marco de nuestra alianza, GRUPO 500 EDUCACIÓN S.A.S. tiene el gusto de otorgar un beneficio institucional del 10% de descuento para todos los estudiantes que deseen prepararse con nuestros diferentes programas Preicfes y Premédico.'
    const lsBen = doc.splitTextToSize(textoBeneficios, cw)
    doc.text(lsBen, ml, y); y += lsBen.length * lh + lh * 0.6

    const textoPreTabla = 'Tenga en cuenta que, con dichos descuentos, estos serían los costos finales de los cursos ofrecidos por GRUPO 500 EDUCACIÓN S.A.S para el año 2026 por cada estudiante:'
    const lsPT = doc.splitTextToSize(textoPreTabla, cw)
    doc.text(lsPT, ml, y); y += lsPT.length * lh + lh * 1.2

    // ── TABLA DE COTIZACIÓN ───────────────────────────────────────────────
    if (y > 230) { y = newPage() }

    const colW   = [108, 27, 31]
    const col1   = ml
    const col2   = ml + colW[0]
    const col3   = ml + colW[0] + colW[1]
    const tableW = colW[0] + colW[1] + colW[2]

    // Fila 0: título de tabla — fondo navy
    const titleH = 8
    doc.setFillColor(...NAVY); doc.setDrawColor(...NAVY); doc.setLineWidth(0.2)
    doc.rect(col1, y, tableW, titleH, 'F')
    doc.setFont(FONT, 'bold'); doc.setFontSize(9); doc.setTextColor(...WHITE)
    doc.text('PROGRAMAS PREICFES Y PREMÉDICO AÑO 2026', col1 + tableW / 2, y + 5.5, { align: 'center' })
    y += titleH

    // Fila 1: cabeceras de columna — fondo azul
    const headerH = 9
    doc.setFillColor(...BLUE); doc.setDrawColor(...BLUE)
    doc.rect(col1, y, colW[0], headerH, 'F')
    doc.rect(col2, y, colW[1], headerH, 'F')
    doc.rect(col3, y, colW[2], headerH, 'F')
    doc.setFont(FONT, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE)
    doc.text('Curso / Programa',  col1 + 2,           y + 5.8)
    doc.text('Precio\nOficial',   col2 + colW[1]/2,   y + 3.3, { align: 'center' })
    doc.text('Precio con\n10% OFF', col3 + colW[2]/2, y + 3.3, { align: 'center' })
    y += headerH

    // Filas de datos — alternando blanco / azul
    TABLA_CURSOS.forEach((row, idx) => {
      const lines  = doc.splitTextToSize(row.curso, colW[0] - 4)
      const rowH   = Math.max(lines.length * 4.2 + 4, 10)
      if (y + rowH > 272) { y = newPage() }

      const isBlue = idx % 2 === 1
      const fillC  = isBlue ? BLUE  : WHITE
      const textC  = isBlue ? WHITE : BLACK

      doc.setFillColor(...fillC); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15)
      doc.rect(col1, y, colW[0], rowH, 'FD')
      doc.rect(col2, y, colW[1], rowH, 'FD')
      doc.rect(col3, y, colW[2], rowH, 'FD')

      const midY = y + rowH / 2 + 1.5
      doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...textC)
      doc.text(lines, col1 + 2, y + 4.2)
      doc.text(formatCOP(row.precio),     col2 + colW[1]/2, midY, { align: 'center' })
      doc.setFont(FONT, 'bold')
      doc.text(formatCOP(row.precioDesc), col3 + colW[2]/2, midY, { align: 'center' })
      y += rowH
    })
    y += lh * 1.5

    // ── Parágrafos ────────────────────────────────────────────────────────
    if (y > 235) { y = newPage() }
    doc.setFont(FONT, 'normal'); doc.setFontSize(10.5); doc.setTextColor(...BLACK)
    const parrafos = [
      'PARÁGRAFO PRIMERO. El valor de los cursos con el descuento institucional aplica hasta el 30 de noviembre de 2026. A partir del 1 de diciembre tendrán su respectivo incremento anual. Si deseas mantener estos precios junto con el descuento institucional deberán inscribirse un mínimo de treinta (30) estudiantes realizando un único pago por Institución en las fechas acordadas.',
      'PARÁGRAFO SEGUNDO. Realizado el pago, la Institución Educativa deberá enviar una lista de los estudiantes beneficiados junto con sus datos de contacto, con el fin de realizar el respectivo control y seguimiento de las inscripciones por Institución.',
      'PARÁGRAFO TERCERO. Es importante precisar que únicamente se considerarán válidas las inscripciones y pagos realizados a través de la única cuenta autorizada de la Sociedad Preicfes Grupo 500. BANCOLOMBIA - AHORROS. Nombre: GRUPO 500 EDUCACION S.A.S. Número de cuenta: 09000004600',
    ]
    for (const p of parrafos) {
      if (y > 255) { y = newPage() }
      const ls = doc.splitTextToSize(p, cw)
      doc.text(ls, ml, y); y += ls.length * lh + lh * 0.6
    }
    y += lh * 0.5

    // ── C. Opción de Financiación ─────────────────────────────────────────
    if (y > 245) { y = newPage() }
    doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    doc.text('C. Opción de Financiación', ml, y); y += lh * 1.8
    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    const textoC = 'Recuerda que tus estudiantes pueden pagar la totalidad del curso de contado. Sin embargo, si todos no cuentan con el recurso de parte del Preicfes Grupo 500 hemos autorizado que cada estudiante realice un primer pago de $300.000 mil pesos en el mes de mayo y el restante en el mes de junio. Esta facilidad de pago aplica en el caso de los Calendario A, Intensivo Calendario A o Calendario G.'
    const lsC = doc.splitTextToSize(textoC, cw)
    doc.text(lsC, ml, y); y += lsC.length * lh + lh * 1.5

    // ── Cierre ────────────────────────────────────────────────────────────
    const cierreText = 'Apreciada Institución, recuerda que puedes extender la invitación del curso a estudiantes de noveno, décimo y undécimo grado. En caso de requerir una reunión virtual con nuestro equipo directivo debes confirmarnos a través de este correo pregrupo500@gmail.com o comunicarte a nuestra línea institucional de WhatsApp 311 5233917'
    const lsCierre = doc.splitTextToSize(cierreText, cw - 14)
    if (y + lsCierre.length * lh + 30 > 272) { y = newPage() }
    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)

    // Ícono WhatsApp junto al texto del cierre
    if (waB64) {
      doc.addImage(waB64, 'PNG', ml, y - 3, 8, 8)
    }
    doc.text(lsCierre, ml + (waB64 ? 11 : 0), y); y += lsCierre.length * lh + lh * 2.5

    // ── Firma ─────────────────────────────────────────────────────────────
    doc.setFont(FONT, 'normal'); doc.setFontSize(11); doc.setTextColor(...BLACK)
    doc.text('Con aprecio,', ml, y); y += lh * 1.8
    doc.setFont(FONT, 'bold'); doc.setTextColor(...BLACK)
    doc.text('GRUPO 500 EDUCACIÓN S.A.S', ml, y); y += lh * 1.2
    doc.setFont(FONT, 'normal'); doc.setTextColor(...BLACK)
    doc.text('NIT No. 901.768.155-8', ml, y)

    if (descargar) {
      doc.save(`Propuesta-${colegio.nombre.replace(/\s+/g, '_')}.pdf`)
    }
    return doc.output('arraybuffer') as unknown as Uint8Array
  }

  function enviarWhatsApp() {
    const tel = colegio.contactoTelefono?.replace(/\D/g, '') ?? ''
    const msg = encodeURIComponent(
      `Hola${colegio.contactoNombre ? ` ${colegio.contactoNombre}` : ''}, le saluda GRUPO 500 EDUCACIÓN S.A.S. Le compartimos la propuesta institucional del programa ALIADOS 500 para *${colegio.nombre}*.\n\nPara mayor información: pregrupo500@gmail.com | WhatsApp 311 5233917`
    )
    const url = tel ? `https://wa.me/57${tel}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
  }

  function enviarEmail() {
    const to = colegio.contactoEmail ?? ''
    const subject = encodeURIComponent(`Propuesta Programa ALIADOS 500 – ${colegio.nombre}`)
    const body = encodeURIComponent(
      `${colegio.contactoNombre ? `Cordial saludo ${colegio.contactoNombre},\n\n` : 'Cordial saludo,\n\n'}Le compartimos la propuesta institucional del Programa ALIADOS 500 de GRUPO 500 EDUCACIÓN S.A.S.\n\nPor favor encuentre adjunta la propuesta en PDF con los detalles del programa y la tabla de precios con el 10% de descuento institucional.\n\nCon aprecio,\nGRUPO 500 EDUCACIÓN S.A.S.\nNIT No. 901.768.155-8\npregrupo500@gmail.com | 311 5233917`
    )
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-2xl shadow-float w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Propuesta Institucional</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Programa ALIADOS 500</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info del colegio */}
          <div className="px-6 py-4 space-y-3">
            <div className="bg-surface-high rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold text-on-surface">{colegio.nombre}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {colegio.ciudad}
              </div>
              {colegio.contactoNombre && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  {colegio.contactoNombre}
                </div>
              )}
              {colegio.contactoEmail && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {colegio.contactoEmail}
                </div>
              )}
              {colegio.contactoTelefono && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {colegio.contactoTelefono}
                </div>
              )}
              {!colegio.contactoNombre && !colegio.contactoEmail && !colegio.contactoTelefono && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠️ Este colegio no tiene datos de contacto. Edítalo para personalizar la propuesta.
                </p>
              )}
              <button
                onClick={() => { onClose(); onEditarColegio(colegio) }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-outline-variant text-xs text-on-surface-variant hover:text-on-surface hover:border-primary/40 transition-colors cursor-pointer"
              >
                ✏️ Editar datos del colegio
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              La propuesta incluirá la carta completa con los datos de <strong>{colegio.nombre}</strong>, la tabla de precios con <strong>10% de descuento institucional</strong> y las condiciones del programa ALIADOS 500.
            </p>
          </div>

          {/* Acciones */}
          <div className="px-6 pb-6 space-y-2">
            <button
              onClick={() => generarPDF(true)}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={enviarWhatsApp}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#20ba58] transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={enviarEmail}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-high border border-outline-variant text-on-surface rounded-xl text-sm font-medium hover:bg-surface-high/80 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Correo
              </button>
            </div>

            <p className="text-[11px] text-on-surface-variant text-center pt-1">
              WhatsApp y correo abren la app correspondiente con el mensaje prellenado
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ColegiosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'colegios' | 'negociaciones'>('colegios')
  const [busqueda, setBusqueda] = useState('')
  const [etapaActiva, setEtapaActiva] = useState<Etapa>('PROSPECTO')

  // Colegios state
  const [modalCrearColegio, setModalCrearColegio] = useState(false)
  const [formColegio, setFormColegio] = useState({ nombre: '', ciudad: '', contactoNombre: '', contactoEmail: '', contactoTelefono: '' })
  const [modalPropuesta, setModalPropuesta] = useState<Colegio | null>(null)
  const [colegioDetalle, setColegioDetalle] = useState<Colegio | null>(null)
  const [modalEditarColegio, setModalEditarColegio] = useState<Colegio | null>(null)
  const [formEditarColegio, setFormEditarColegio] = useState({ nombre: '', ciudad: '', contactoNombre: '', contactoEmail: '', contactoTelefono: '' })

  // Negociaciones state
  const [modalCrearNeg, setModalCrearNeg] = useState(false)
  const [modalEditarNeg, setModalEditarNeg] = useState<Negociacion | null>(null)
  const [formNeg, setFormNeg] = useState({
    colegioId: '', asesorId: '', etapa: 'PROSPECTO' as Etapa,
    notas: '', fechaContacto: '', fechaReunion: '', fechaProxContacto: '',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  // ── Queries ──
  const { data: colegiosData, isLoading: loadingColegios } = useQuery({
    queryKey: ['colegios'],
    queryFn: () => fetcher<any>('/colegios'),
  })
  const { data: negData, isLoading: loadingNeg } = useQuery({
    queryKey: ['negociaciones'],
    queryFn: () => fetcher<any>('/negociaciones'),
  })
  const { data: asesoresData } = useQuery({
    queryKey: ['asesores-select'],
    queryFn: () => fetcher<any>('/asesores?limit=100'),
  })

  // ── Mutations colegios ──
  const crearColegioMutation = useMutation({
    mutationFn: () => fetcher('/colegios', { method: 'POST', body: JSON.stringify(formColegio) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colegios'] })
      setModalCrearColegio(false)
      setFormColegio({ nombre: '', ciudad: '', contactoNombre: '', contactoEmail: '', contactoTelefono: '' })
    },
  })

  const editarColegioMutation = useMutation({
    mutationFn: () => fetcher(`/colegios/${modalEditarColegio?.id}`, {
      method: 'PATCH', body: JSON.stringify(formEditarColegio),
    }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['colegios'] })
      // Actualizar colegioDetalle si es el mismo que se editó
      if (colegioDetalle?.id === modalEditarColegio?.id) setColegioDetalle(res?.data ?? null)
      setModalEditarColegio(null)
    },
    onError: (e: any) => alert(e?.message ?? 'Error al guardar'),
  })

  const abrirEditarColegio = (c: Colegio) => {
    setFormEditarColegio({
      nombre:           c.nombre,
      ciudad:           c.ciudad,
      contactoNombre:   c.contactoNombre   ?? '',
      contactoEmail:    c.contactoEmail    ?? '',
      contactoTelefono: c.contactoTelefono ?? '',
    })
    setModalEditarColegio(c)
  }

  // ── Mutations negociaciones ──
  const resetFormNeg = () => setFormNeg({ colegioId: '', asesorId: '', etapa: 'PROSPECTO', notas: '', fechaContacto: '', fechaReunion: '', fechaProxContacto: '' })

  const crearNegMutation = useMutation({
    mutationFn: () => fetcher('/negociaciones', { method: 'POST', body: JSON.stringify(formNeg) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalCrearNeg(false); resetFormNeg() },
    onError: (e: any) => alert(e?.message ?? 'Error al crear'),
  })

  const actualizarNegMutation = useMutation({
    mutationFn: (data: Partial<typeof formNeg>) =>
      fetcher(`/negociaciones/${modalEditarNeg?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalEditarNeg(null) },
    onError: (e: any) => alert(e?.message ?? 'Error al actualizar'),
  })

  const eliminarNegMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/negociaciones/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalEditarNeg(null) },
  })

  const abrirEditarNeg = (neg: Negociacion) => {
    setFormNeg({
      colegioId: neg.colegio.id, asesorId: neg.asesor.id, etapa: neg.etapa,
      notas: neg.notas ?? '',
      fechaContacto:     neg.fechaContacto    ? neg.fechaContacto.split('T')[0]    : '',
      fechaReunion:      neg.fechaReunion     ? neg.fechaReunion.split('T')[0]     : '',
      fechaProxContacto: neg.fechaProxContacto ? neg.fechaProxContacto.split('T')[0] : '',
    })
    setModalEditarNeg(neg)
  }

  const colegiosTodos: Colegio[] = colegiosData?.data ?? []
  const colegios = colegiosTodos.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.ciudad.toLowerCase().includes(busqueda.toLowerCase())
  )
  const negociaciones: Negociacion[] = negData?.data ?? []
  const asesores                 = asesoresData?.data ?? []
  const tarjetasActivas          = negociaciones.filter(n => n.etapa === etapaActiva)
  const cfgActiva                = ETAPAS.find(e => e.etapa === etapaActiva)!

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const NegFormFields = ({ value: f, onChange }: { value: typeof formNeg; onChange: (f: typeof formNeg) => void }) => (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Colegio *</label>
        <select className={inputCls} value={f.colegioId} onChange={e => onChange({ ...f, colegioId: e.target.value })}>
          <option value="">Seleccionar colegio…</option>
          {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Asesor asignado *</label>
        <select className={inputCls} value={f.asesorId} onChange={e => onChange({ ...f, asesorId: e.target.value })}>
          <option value="">Seleccionar asesor…</option>
          {asesores.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Etapa</label>
        <select className={inputCls} value={f.etapa} onChange={e => onChange({ ...f, etapa: e.target.value as Etapa })}>
          {ETAPAS.map(c => <option key={c.etapa} value={c.etapa}>{c.label}</option>)}
        </select>
      </div>
      {f.etapa !== 'PROSPECTO' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fecha contacto</label>
            <input type="date" className={inputCls} value={f.fechaContacto} onChange={e => onChange({ ...f, fechaContacto: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Fecha reunión</label>
            <input type="date" className={inputCls} value={f.fechaReunion} onChange={e => onChange({ ...f, fechaReunion: e.target.value })} />
          </div>
        </div>
      )}
      <div>
        <label className={labelCls}>Próximo contacto</label>
        <input type="date" className={inputCls} value={f.fechaProxContacto} onChange={e => onChange({ ...f, fechaProxContacto: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Notas</label>
        <textarea className={inputCls} rows={3} value={f.notas} onChange={e => onChange({ ...f, notas: e.target.value })} placeholder="Observaciones del proceso…" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Colegios"
        subtitle="Gestiona colegios y el pipeline de negociaciones"
        actions={
          tab === 'colegios' ? (
            <button onClick={() => setModalCrearColegio(true)} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline"> Nuevo colegio</span>
            </button>
          ) : isAdmin ? (
            <button onClick={() => { resetFormNeg(); setModalCrearNeg(true) }} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline"> Nueva negociación</span>
            </button>
          ) : undefined
        }
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-surface-high border border-outline-variant rounded-xl p-1 w-fit">
        {([
          { id: 'colegios',      label: 'Colegios',      icon: School,    count: colegiosTodos.length },
          { id: 'negociaciones', label: 'Negociaciones', icon: Handshake, count: negociaciones.length },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={cn(
              'text-[11px] px-1.5 py-0.5 rounded-full font-semibold',
              tab === t.id ? 'bg-primary/10 text-primary' : 'bg-outline-variant/50 text-on-surface-variant',
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: COLEGIOS
      ══════════════════════════════════════════ */}
      {tab === 'colegios' && (
        <>
        {/* Búsqueda */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por nombre o ciudad..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} className="px-3 py-2 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loadingColegios ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : colegios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
            <School className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay colegios registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {colegios.map(c => (
              <div key={c.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3.5 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col gap-3">

                {/* ── Header: icono + nombre + ciudad ── */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <School className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-on-surface truncate leading-snug">{c.nombre}</p>
                    <p className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{c.ciudad}</span>
                    </p>
                  </div>
                </div>

                {/* ── Footer: badge estudiantes + acciones ── */}
                <div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/60">
                  <div className="flex items-center gap-1 bg-primary/8 px-2 py-1 rounded-lg">
                    <Users className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-[11px] font-bold text-primary tabular">{c._count?.estudiantes ?? 0}</span>
                    <span className="text-[11px] text-on-surface-variant">est.</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => abrirEditarColegio(c)}
                      title="Editar colegio"
                      className="p-1.5 text-on-surface-variant hover:bg-surface-high rounded-lg transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => setModalPropuesta(c)}
                      title="Generar propuesta"
                      className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setColegioDetalle(c)}
                      title="Ver estudiantes"
                      className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
        </>
      )}

      {/* ══════════════════════════════════════════
          TAB: NEGOCIACIONES — Pipeline
      ══════════════════════════════════════════ */}
      {tab === 'negociaciones' && (
        loadingNeg ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <div className="space-y-5">

            {/* ── Selector móvil ── */}
            <div className="md:hidden">
              <select
                value={etapaActiva}
                onChange={e => setEtapaActiva(e.target.value as Etapa)}
                className="w-full bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {ETAPAS.map(cfg => {
                  const count = negociaciones.filter(n => n.etapa === cfg.etapa).length
                  return (
                    <option key={cfg.etapa} value={cfg.etapa}>
                      {cfg.label}{count > 0 ? ` (${count})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* ── Barra de pipeline — solo desktop ── */}
            <div className="hidden md:block bg-surface-lowest border border-outline-variant rounded-xl p-4">
              <div className="flex items-center w-full gap-0">
                {ETAPAS.map((cfg, i) => {
                  const count  = negociaciones.filter(n => n.etapa === cfg.etapa).length
                  const activo = etapaActiva === cfg.etapa
                  const isLast = i === ETAPAS.length - 1

                  return (
                    <div key={cfg.etapa} className="flex items-center flex-1 min-w-0">
                      {/* Paso */}
                      <button
                        onClick={() => setEtapaActiva(cfg.etapa)}
                        className={cn(
                          'flex flex-col items-center gap-1 flex-1 py-2.5 px-1 rounded-xl transition-all duration-200 min-w-0',
                          activo ? `${cfg.bgActive} shadow-sm` : 'hover:bg-surface-high',
                        )}
                      >
                        {/* Número / dot */}
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                          activo
                            ? 'bg-white/20 text-white'
                            : count > 0
                              ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                              : 'bg-surface-high text-on-surface-variant border border-outline-variant',
                        )}>
                          {count > 0 ? count : <span className="w-2 h-2 rounded-full bg-current opacity-30 block" />}
                        </div>

                        {/* Label */}
                        <span className={cn(
                          'text-[10px] font-semibold leading-tight text-center truncate w-full px-1 transition-colors',
                          activo ? 'text-white' : count > 0 ? cfg.color : 'text-on-surface-variant',
                        )}>
                          {cfg.labelCorto}
                        </span>
                      </button>

                      {/* Conector */}
                      {!isLast && (
                        <div className={cn(
                          'h-px w-3 flex-shrink-0 transition-colors',
                          negociaciones.some(n => ETAPAS.indexOf(ETAPAS.find(e => e.etapa === n.etapa)!) > i)
                            ? 'bg-primary/40'
                            : 'bg-outline-variant',
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Encabezado de etapa activa ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn('w-3 h-3 rounded-full', cfgActiva.dot)} />
                <h3 className={cn('text-sm font-semibold', cfgActiva.color)}>{cfgActiva.label}</h3>
                <span className="text-xs text-on-surface-variant">
                  — {tarjetasActivas.length} negociación{tarjetasActivas.length !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>

            {/* ── Grid de tarjetas ── */}
            {tarjetasActivas.length === 0 ? (
              <div className={cn('flex flex-col items-center justify-center py-14 rounded-xl border border-dashed', cfgActiva.bg, cfgActiva.border)}>
                <span className={cn('text-3xl mb-2 opacity-30', cfgActiva.dot.replace('bg-', 'text-'))}>◉</span>
                <p className="text-sm text-on-surface-variant">Sin negociaciones en esta etapa</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {tarjetasActivas.map(neg => (
                  <NegCard key={neg.id} neg={neg} onClick={() => abrirEditarNeg(neg)} />
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* ── Modal crear colegio ── */}
      <Modal open={modalCrearColegio} onClose={() => setModalCrearColegio(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo colegio</h2>
            <button onClick={() => setModalCrearColegio(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nombre del colegio *</label>
              <input className={inputCls} value={formColegio.nombre} onChange={e => setFormColegio(f => ({ ...f, nombre: e.target.value }))} placeholder="Colegio La Salle" />
            </div>
            <div>
              <label className={labelCls}>Ciudad *</label>
              <input className={inputCls} value={formColegio.ciudad} onChange={e => setFormColegio(f => ({ ...f, ciudad: e.target.value }))} placeholder="Bogotá" />
            </div>
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider pt-1">Contacto institucional</p>
            <div>
              <label className={labelCls}>Rector / Coordinador</label>
              <input className={inputCls} value={formColegio.contactoNombre} onChange={e => setFormColegio(f => ({ ...f, contactoNombre: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Correo institucional</label>
                <input type="email" className={inputCls} value={formColegio.contactoEmail} onChange={e => setFormColegio(f => ({ ...f, contactoEmail: e.target.value }))} placeholder="rectoria@colegio.edu.co" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp / Teléfono</label>
                <input className={inputCls} value={formColegio.contactoTelefono} onChange={e => setFormColegio(f => ({ ...f, contactoTelefono: e.target.value }))} placeholder="3001234567" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrearColegio(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearColegioMutation.mutate()}
              disabled={crearColegioMutation.isPending || !formColegio.nombre || !formColegio.ciudad}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearColegioMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal crear negociación ── */}
      <Modal open={modalCrearNeg} onClose={() => setModalCrearNeg(false)}>
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Nueva negociación</h2>
            <button onClick={() => setModalCrearNeg(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <NegFormFields value={formNeg} onChange={setFormNeg} />
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setModalCrearNeg(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearNegMutation.mutate()}
              disabled={crearNegMutation.isPending || !formNeg.colegioId || !formNeg.asesorId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearNegMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal estudiantes del colegio ── */}
      {colegioDetalle && (
        <EstudiantesColegioModal
          colegio={colegioDetalle}
          onClose={() => setColegioDetalle(null)}
          fetcher={fetcher}
        />
      )}

      {/* ── Modal propuesta institucional ── */}
      {modalPropuesta && (
        <PropuestaModal
          colegio={modalPropuesta}
          onClose={() => setModalPropuesta(null)}
          onEditarColegio={(c) => { setModalPropuesta(null); abrirEditarColegio(c) }}
        />
      )}

      {/* ── Modal editar colegio ── */}
      <Modal open={!!modalEditarColegio} onClose={() => setModalEditarColegio(null)}>
        <div className="p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Editar colegio</h2>
            <button onClick={() => setModalEditarColegio(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Nombre del colegio *</label>
              <input className={inputCls} value={formEditarColegio.nombre}
                onChange={e => setFormEditarColegio(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Ciudad *</label>
              <input className={inputCls} value={formEditarColegio.ciudad}
                onChange={e => setFormEditarColegio(f => ({ ...f, ciudad: e.target.value }))} />
            </div>
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide pt-1">Contacto institucional</p>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Nombre del contacto</label>
              <input className={inputCls} value={formEditarColegio.contactoNombre} placeholder="Rector / Coordinador"
                onChange={e => setFormEditarColegio(f => ({ ...f, contactoNombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Email</label>
              <input type="email" className={inputCls} value={formEditarColegio.contactoEmail} placeholder="rectoria@colegio.edu.co"
                onChange={e => setFormEditarColegio(f => ({ ...f, contactoEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Teléfono / WhatsApp</label>
              <input className={inputCls} value={formEditarColegio.contactoTelefono} placeholder="3001234567"
                onChange={e => setFormEditarColegio(f => ({ ...f, contactoTelefono: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setModalEditarColegio(null)}
              className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => editarColegioMutation.mutate()}
              disabled={editarColegioMutation.isPending || !formEditarColegio.nombre || !formEditarColegio.ciudad}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {editarColegioMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal editar negociación ── */}
      <Modal open={!!modalEditarNeg} onClose={() => setModalEditarNeg(null)}>
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Actualizar negociación</h2>
            <button onClick={() => setModalEditarNeg(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <NegFormFields value={formNeg} onChange={setFormNeg} />
          <div className="flex items-center justify-between mt-5">
            {isAdmin && (
              <button
                onClick={() => { if (confirm('¿Eliminar esta negociación?')) eliminarNegMutation.mutate(modalEditarNeg!.id) }}
                className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button onClick={() => setModalEditarNeg(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
              <button
                onClick={() => actualizarNegMutation.mutate(formNeg)}
                disabled={actualizarNegMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {actualizarNegMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

