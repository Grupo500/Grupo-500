'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { Modal } from '@/components/ui/Modal'
import { CircleDollarSign, ChevronRight, Phone, FileText, Copy, Check, Clock, RefreshCw } from 'lucide-react'

interface PersonaGestion {
  estudianteId: string
  nombre: string
  telefono: string
  curso: string
  saldo: number
  asesor: string | null
  metodo: string | null
  total: number
  pagado: number
  abonos: number
  /** El código de Hotmart. Null si la compra se registró a mano. */
  hp: string | null
  documento: string | null
  ultimoPagoEn: string | null
  fechaCompra: string | null
  diasSinAbonar: number | null
}
interface PersonaAutomatico extends PersonaGestion {
  cuotaNumero: number
  cuotasTotal: number
}
interface PorCobrar {
  total: number
  estudiantes: number
  automatico: { monto: number; estudiantes: number }
  gestion: { monto: number; estudiantes: number }
  cuotasFaltantes: { faltan: number; estudiantes: number }[]
  porGestionar: PersonaGestion[]
  porAutomatico: PersonaAutomatico[]
}

// El método llega tal cual lo reporta Hotmart o el formulario de inscripción
// (CREDIT_CARD, PIX, Nequi, Efecty...) — solo se pareja mayúscula/espaciado.
function metodoLegible(metodo: string | null) {
  if (!metodo) return 'Método sin registrar'
  return metodo
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * El total, en el hueco que dejaba el encabezado.
 *
 * Ese número vive en la tarjeta de atrás, que el propio modal tapa justo al
 * abrirlo. Va un punto más pequeño que los montos de cada fila para que no
 * compita con ellos: resume, no encabeza la lectura.
 *
 * En móvil se muestra igual, solo que sin la palabra "por cobrar" y un punto
 * más chico: en una pantalla de 360px esa línea no cabe junto al título, y el
 * dato es la cifra — la etiqueta la da el propio título de la ventana.
 */
function TotalCabecera({ monto, tono }: { monto: number; tono?: string }) {
  return (
    <div className="text-right">
      <p
        className="text-[12.5px] font-bold leading-none tabular-nums sm:text-[14px]"
        style={{ color: tono ?? 'var(--on-surface)' }}
      >
        {formatCOP(monto)}
      </p>
      <p className="mt-1 hidden text-[9.5px] text-on-surface-variant sm:block">por cobrar</p>
    </div>
  )
}

const diaCorto = (iso: string | null) =>
  iso ? format(new Date(iso), "d 'de' MMM", { locale: es }) : null

/** "hace 2 meses", "hace 6 días". Sin precisión falsa: por encima de 60 días
 *  el número exacto ya no cambia la decisión, y los meses se leen más rápido. */
function haceCuanto(dias: number | null) {
  if (dias == null) return null
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 60) return `hace ${dias} días`
  return `hace ${Math.round(dias / 30)} meses`
}

/**
 * Una deuda que hay que perseguir, con lo necesario para decidir a quién se
 * llama primero y qué se le dice. El orden lo pone el servidor: por días en
 * silencio, no por monto.
 */
function FilaGestion({ p }: { p: PersonaGestion }) {
  const [copiado, setCopiado] = useState(false)
  const pct = p.total > 0 ? Math.min(100, Math.round((p.pagado / p.total) * 100)) : 0
  const nunca = p.abonos === 0
  const dias = p.diasSinAbonar

  // Rojo cuando el silencio ya es largo; azul cuando la compra es reciente y
  // todavía no hay nada que reprochar.
  const urgente = dias != null && dias >= 30
  const tono = urgente
    ? { fondo: 'rgba(220,38,38,0.13)', texto: '#dc2626' }
    : dias != null && dias >= 8
      ? { fondo: 'rgba(245,158,11,0.14)', texto: '#b45309' }
      : { fondo: 'rgba(32,148,255,0.13)', texto: 'var(--primary)' }

  const etiqueta = nunca
    ? (dias != null ? `Sin abonar · compró ${haceCuanto(dias)}` : 'Sin abonar')
    : `Sin abonar ${haceCuanto(dias) ?? ''}`.trim()

  const copiarHp = async () => {
    if (!p.hp) return
    try {
      await navigator.clipboard.writeText(p.hp)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch { /* sin portapapeles: el HP igual está a la vista */ }
  }

  return (
    <div className="border-t border-surface-high py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[13.5px] font-semibold text-on-surface">{p.nombre}</p>
            <span
              className="rounded-full px-2 py-0.5 text-[9.5px] font-bold"
              style={{ background: tono.fondo, color: tono.texto }}
            >
              {etiqueta}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-on-surface-variant">
            {p.curso}{p.asesor && ` · ${p.asesor}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums" style={{ color: '#b45309' }}>
            {formatCOP(p.saldo)}
          </p>
          <p className="mt-0.5 text-[10px] text-on-surface-variant tabular-nums">de {formatCOP(p.total)}</p>
        </div>
      </div>

      {/* Cuánto de la relación va cumplido: quien ya puso el 40% se recupera
          con un mensaje; quien no ha puesto nada es otra conversación. */}
      <div className="mt-2.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-high">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#16a34a' }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[10.5px] text-on-surface-variant tabular-nums">
          <span>
            {nunca
              ? <span className="font-semibold text-on-surface">Sin ningún abono</span>
              : <>Abonó <span className="font-semibold text-on-surface">{formatCOP(p.pagado)}</span> en {p.abonos} {p.abonos === 1 ? 'pago' : 'pagos'}</>}
          </span>
          <span>Le falta el <span className="font-semibold text-on-surface">{100 - pct}%</span></span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          { k: 'HP', v: p.hp, vacio: 'Pago manual' },
          { k: 'Último abono', v: p.ultimoPagoEn ? `${diaCorto(p.ultimoPagoEn)} · ${metodoLegible(p.metodo)}` : null, vacio: 'Nunca', alerta: true },
          { k: 'Compró', v: diaCorto(p.fechaCompra), vacio: 'Sin fecha' },
          { k: 'Documento', v: p.documento, vacio: 'Sin registrar' },
        ].map(d => (
          <div key={d.k} className="min-w-0 rounded-lg bg-surface-low px-2.5 py-1.5">
            <p className="text-[9.5px] text-on-surface-variant">{d.k}</p>
            <p
              className="truncate text-[11.5px] font-semibold"
              style={{ color: d.v ? (d.alerta ? '#b45309' : 'var(--on-surface)') : 'var(--on-surface-variant)' }}
              title={d.v ?? d.vacio}
            >
              {d.v ?? d.vacio}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {p.telefono && (
          <a
            href={`https://wa.me/57${p.telefono.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Phone className="size-3" /> WhatsApp
          </a>
        )}
        <Link
          href={`/estudiantes/${p.estudianteId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          <FileText className="size-3" /> Ver ficha
        </Link>
        {p.hp && (
          <button
            onClick={copiarHp}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-high"
          >
            {copiado ? <Check className="size-3" style={{ color: '#16a34a' }} /> : <Copy className="size-3" />}
            {copiado ? 'Copiado' : 'Copiar HP'}
          </button>
        )}
      </div>
    </div>
  )
}

function Fila({ p, tipo }: { p: PersonaGestion | PersonaAutomatico; tipo: 'automatico' | 'gestion' }) {
  const esAutomatico = tipo === 'automatico'
  return (
    <div className="flex items-start gap-3 py-3 border-t border-surface-high first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-on-surface truncate">{p.nombre}</p>
        <p className="text-[11.5px] text-on-surface-variant truncate mt-0.5">
          {p.curso}{p.asesor && ` · ${p.asesor}`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface-high)', color: 'var(--on-surface-variant)' }}
          >
            {metodoLegible(p.metodo)}
          </span>
          {esAutomatico && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}
            >
              Cuota {(p as PersonaAutomatico).cuotaNumero} de {(p as PersonaAutomatico).cuotasTotal}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13.5px] font-bold tabular-nums text-on-surface">{formatCOP(p.saldo)}</p>
        {p.telefono && (
          <a
            href={`https://wa.me/57${p.telefono.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10.5px] text-primary hover:underline mt-1.5"
          >
            <Phone className="w-3 h-3" /> Contactar
          </a>
        )}
      </div>
    </div>
  )
}

export function PendientesPorCobrar() {
  const [modal, setModal] = useState<'automatico' | 'gestion' | null>(null)

  // No depende del período seleccionado en la página: una deuda de meses
  // atrás sigue pendiente aunque el filtro de fechas esté en el mes actual.
  const { data, isLoading } = useQuery({
    queryKey: ['pendientes-por-cobrar'],
    queryFn: async () => apiFetch('/reportes/por-cobrar') as Promise<{ data: PorCobrar }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const animTotal = useCountUp(isLoading ? 0 : d?.total ?? 0)

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-40 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-8 w-52 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-2 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-16 rounded-xl bg-surface-high animate-pulse" />
      </div>
    )
  }

  if (!d || d.total === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Pendiente por cobrar</h3>
        </div>
        <p className="text-[13px] text-on-surface-variant text-center py-6">
          Todo al día. Sin saldos abiertos pendientes de cobro.
        </p>
      </div>
    )
  }

  const pctAuto = d.total > 0 ? (d.automatico.monto / d.total) * 100 : 0
  const cuotasTexto = d.cuotasFaltantes
    .map(c => `${c.estudiantes} deben ${c.faltan} ${c.faltan === 1 ? 'cuota' : 'cuotas'}`)
    .join(' · ')

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Pendiente por cobrar</h3>
        </div>
        <span className="text-[11px] text-on-surface-variant tabular-nums shrink-0 mt-1.5">
          {d.estudiantes} estudiante{d.estudiantes !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-[32px] font-bold tabular-nums leading-none text-on-surface">{formatCOP(animTotal)}</p>
      <p className="text-[12.5px] text-on-surface-variant mt-1.5 mb-4">
        {d.gestion.monto > 0 ? (
          <>Solo <span className="font-semibold" style={{ color: '#b45309' }}>{formatCOP(d.gestion.monto)}</span> necesitan gestión</>
        ) : (
          'Todo se cobra automáticamente'
        )}
      </p>

      {/* Proporción entre lo que llega solo y lo que hay que perseguir */}
      <div className="flex gap-[3px] mb-4">
        <div className="h-2 rounded-l" style={{ width: `${pctAuto}%`, background: 'var(--primary)' }} />
        <div className="h-2 rounded-r flex-1" style={{ background: '#f59e0b' }} />
      </div>

      <button
        onClick={() => d.porAutomatico.length > 0 && setModal('automatico')}
        disabled={d.porAutomatico.length === 0}
        className="w-full text-left rounded-xl bg-surface-low p-3.5 mb-2.5 transition-colors enabled:hover:bg-surface-high enabled:cursor-pointer disabled:cursor-default"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--primary)' }} />
            Hotmart lo cobra solo
          </span>
          <span className="flex items-center gap-1 text-[15px] font-semibold tabular-nums text-on-surface">
            {formatCOP(d.automatico.monto)}
            {d.porAutomatico.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />}
          </span>
        </div>
        <p className="text-[11.5px] text-on-surface-variant mt-1 ml-4">
          {d.automatico.estudiantes} con cuotas programadas{cuotasTexto && ` · ${cuotasTexto}`}
        </p>
      </button>

      {d.gestion.estudiantes > 0 && (
        <button
          onClick={() => setModal('gestion')}
          className="w-full text-left rounded-xl p-3.5 transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: 'rgba(245,158,11,0.12)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#b45309' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
              Requiere gestión
            </span>
            <span className="flex items-center gap-1 text-[15px] font-semibold tabular-nums" style={{ color: '#b45309' }}>
              {formatCOP(d.gestion.monto)}
              <ChevronRight className="w-3.5 h-3.5" style={{ color: '#b45309', opacity: 0.7 }} />
            </span>
          </div>
          <p className="text-[11.5px] mt-1 ml-4" style={{ color: '#b45309', opacity: 0.85 }}>
            {d.gestion.estudiantes} estudiante{d.gestion.estudiantes !== 1 ? 's' : ''} sin plan de cuotas automático
          </p>
        </button>
      )}

      <Modal
        abierto={modal === 'automatico'}
        onClose={() => setModal(null)}
        titulo="Hotmart lo cobra solo"
        subtitulo={`${d.porAutomatico.length} estudiante${d.porAutomatico.length !== 1 ? 's' : ''} con cuotas programadas`}
        // Repetición: son cobros que vuelven solos cada mes.
        icono={RefreshCw}
        extra={<TotalCabecera monto={d.automatico.monto} />}
      >
        {d.porAutomatico.map(p => <Fila key={p.estudianteId + p.curso} p={p} tipo="automatico" />)}
      </Modal>

      <Modal
        abierto={modal === 'gestion'}
        onClose={() => setModal(null)}
        titulo="Requiere gestión"
        subtitulo={`${d.gestion.estudiantes} estudiante${d.gestion.estudiantes !== 1 ? 's' : ''} · por tiempo sin abonar`}
        // Reloj: lo que ordena esta lista es el tiempo, no el monto.
        icono={Clock}
        extra={<TotalCabecera monto={d.gestion.monto} tono="#b45309" />}
      >
        {d.porGestionar.map(p => <FilaGestion key={p.estudianteId + p.curso} p={p} />)}
      </Modal>
    </div>
  )
}
