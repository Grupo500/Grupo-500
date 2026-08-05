'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, cn } from '@/lib/utils'
import { pct, numero, TarjetaKPI, FilaParticipacion, Variacion } from '@/components/finanzas/comunes'
import {
  analizarGastos, colorCategoria, etiquetaPeriodo, MESES_CORTOS, MESES_GASTOS,
  type GastosAgenciaData, type AnalisisGastos, type Tendencia,
} from '@/lib/gastosAgencia'
import {
  TablaContabilidad, TablaNomina, TablaProduccion, TablaTarifario, AvisoSoloLectura,
} from '@/components/finanzas/gastos/Tablas'

/** Secciones del módulo. El resumen analiza; las demás permiten diligenciar. */
const SECCIONES = [
  { id: 'resumen', et: 'Resumen' },
  { id: 'contabilidad', et: 'Contabilidad' },
  { id: 'nomina', et: 'Nómina' },
  { id: 'produccion', et: 'Producción' },
  { id: 'tarifario', et: 'Tarifario' },
] as const

type Seccion = typeof SECCIONES[number]['id']

/** Cifra corta para ejes: 45,8 M en vez de 45.800.000. */
function corto(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1).replace('.', ',')} MM`
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')} M`
  if (a >= 1e3) return `${Math.round(v / 1e3)} k`
  return String(Math.round(v))
}

const PRESETS = [
  { id: 'todo', et: 'Todo el año' },
  { id: 'u3', et: 'Últimos 3', ventana: 3 },
  { id: 'u6', et: 'Últimos 6', ventana: 6 },
  { id: 't1', et: 'T1', desde: 0, hasta: 2 },
  { id: 't2', et: 'T2', desde: 3, hasta: 5 },
  { id: 't3', et: 'T3', desde: 6, hasta: 8 },
  { id: 't4', et: 'T4', desde: 9, hasta: 11 },
] as const

function rangoDePreset(p: typeof PRESETS[number], disponibles: number[]) {
  if (p.id === 'todo') return { desde: null, hasta: null }
  if ('ventana' in p) {
    const v = disponibles.slice(-p.ventana)
    return v.length ? { desde: v[0], hasta: v[v.length - 1] } : null
  }
  const dentro = disponibles.filter(i => i >= p.desde && i <= p.hasta)
  return dentro.length ? { desde: dentro[0], hasta: dentro[dentro.length - 1] } : null
}

const ESTILO_TENDENCIA: Record<Tendencia, string> = {
  'creciendo': 'bg-rose-500/12 text-rose-600',
  'cayendo': 'bg-emerald-500/12 text-emerald-600',
  'estable': 'bg-surface-high text-on-surface-variant',
  'errático': 'bg-amber-500/12 text-amber-600',
  'sin datos': 'bg-surface-high text-on-surface-variant/70',
}

const BORDE_TONO = { alerta: '#dc2626', bueno: '#16a34a', neutro: 'var(--primary)' } as const

/** Globo de los gráficos: sólido y ordenado, no el translúcido de Recharts. */
function Globo({ active, payload, label, sufijo }: {
  active?: boolean
  payload?: { name?: string; dataKey?: string; value?: number; color?: string; payload?: Record<string, unknown> }[]
  label?: string
  sufijo?: (fila: Record<string, unknown>) => React.ReactNode
}) {
  if (!active || !payload?.length) return null
  const filas = payload.filter(p => typeof p.value === 'number' && p.value !== 0)
  const totalMes = filas.reduce((a, p) => a + (p.value ?? 0), 0)

  return (
    <div className="rounded-xl border border-surface-high bg-surface-container-lowest shadow-lg px-3 py-2.5 min-w-[210px]">
      <p className="text-[11.5px] font-semibold text-on-surface mb-1.5">{String(label)}</p>
      <div className="space-y-1">
        {filas.map(p => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="text-[12px] tabular-nums text-on-surface">{formatCOP(p.value ?? 0)}</span>
          </div>
        ))}
        {filas.length > 1 && (
          <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-surface-high">
            <span className="text-[11.5px] font-medium text-on-surface-variant">Total del mes</span>
            <span className="text-[12px] font-semibold tabular-nums text-on-surface">{formatCOP(totalMes)}</span>
          </div>
        )}
        {sufijo && payload[0]?.payload && sufijo(payload[0].payload)}
      </div>
    </div>
  )
}

export default function GastosAgenciaPage() {
  const [seccion, setSeccion] = useState<Seccion>('resumen')
  const [anio, setAnio] = useState<string | null>(null)
  const [apagadas, setApagadas] = useState<Set<string>>(new Set())
  const [desde, setDesde] = useState<number | null>(null)
  const [hasta, setHasta] = useState<number | null>(null)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['finanzas-gastos-agencia'],
    queryFn: async () => apiFetch('/finanzas/gastos-agencia') as Promise<{ data: GastosAgenciaData }>,
    staleTime: 5 * 60_000,
  })

  const datos = data?.data
  const anios = useMemo(
    () => Object.keys(datos?.anios ?? {}).sort((a, b) => Number(b) - Number(a)),
    [datos],
  )
  const anioActivo = anio && datos?.anios[anio] ? anio : anios[0]

  const analisis: AnalisisGastos | null = useMemo(() => {
    if (!datos || !anioActivo) return null
    const todas = datos.anios[anioActivo].categorias.map(c => c.clave)
    const activas = new Set(todas.filter(c => !apagadas.has(c)))
    return analizarGastos(datos, {
      anio: anioActivo,
      activas: activas.size === todas.length ? null : activas,
      desde, hasta,
    })
  }, [datos, anioActivo, apagadas, desde, hasta])

  const cambiarAnio = (y: string) => {
    setAnio(y)
    // El rango del año anterior puede no existir en el nuevo.
    setDesde(null); setHasta(null); setApagadas(new Set())
  }

  const alternarCategoria = (clave: string) => {
    setApagadas(prev => {
      const n = new Set(prev)
      if (n.has(clave)) n.delete(clave)
      // Nunca dejar el panel sin ninguna categoría encendida.
      else if (prev.size < (datos?.anios[anioActivo!]?.categorias.length ?? 0) - 1) n.add(clave)
      return n
    })
  }

  // ── datos para los gráficos ──────────────────────────────────────────
  const serieApilada = useMemo(() => {
    if (!analisis) return []
    return analisis.mesesActivos.map(i => {
      const fila: Record<string, string | number> = { mes: MESES_CORTOS[i] }
      for (const c of analisis.categorias) fila[c.clave] = c.valores[i] ?? 0
      return fila
    })
  }, [analisis])

  const serieAnual = useMemo(() => {
    if (!analisis) return []
    const meses = analisis.rangoCompleto ? MESES_GASTOS.map((_, i) => i) : analisis.mesesActivos
    return meses.map(i => ({
      mes: MESES_CORTOS[i],
      actual: analisis.porMes[i],
      previo: analisis.previoPorMes?.[i] ?? null,
    }))
  }, [analisis])

  const serieProduccion = useMemo(() => {
    const ef = analisis?.eficiencia
    if (!ef) return []
    return ef.mesesConPiezas.map(i => ({
      mes: MESES_CORTOS[i],
      piezas: ef.piezasPorMes[i] ?? 0,
      costo: ef.costoPorPieza[i],
      horas: ef.horasPorMes[i],
    }))
  }, [analisis])

  const mayorCategoria = Math.max(...(analisis?.categorias ?? []).map(c => c.total), 1)
  const anioPrevio = anioActivo ? Number(anioActivo) - 1 : null

  // ── estados de carga y error ─────────────────────────────────────────
  if (isError) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Gastos de agencia" subtitle="Contabilidad interna de la agencia" />
        <div className="card p-6">
          <p className="text-[13px] text-on-surface">No pude leer los gastos de la agencia.</p>
          <p className="text-[12px] text-on-surface-variant mt-1">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high text-[12.5px] font-medium text-on-surface cursor-pointer hover:bg-surface-highest transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Gastos de agencia"
        subtitle={
          datos
            ? `Corte «${datos.nomina.corte || '—'}» · ${analisis ? etiquetaPeriodo(analisis) : '—'} ${anioActivo ?? ''}`
            : 'Contabilidad interna de la agencia'
        }
        actions={
          <div className="flex items-center gap-2">
            {anios.length > 1 && (
              <div className="inline-flex rounded-lg bg-surface-low p-0.5">
                {anios.map(y => (
                  <button
                    key={y}
                    onClick={() => cambiarAnio(y)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer tabular-nums',
                      y === anioActivo
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Volver a leer el Google Sheet"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-low text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefetching && 'animate-spin')} />
            </button>
          </div>
        }
      />

      {datos?.desactualizado && (
        <div className="card p-3 border-l-2 border-l-amber-500">
          <p className="text-[12.5px] text-on-surface">
            El Google Sheet no respondió, estás viendo la última lectura guardada.
          </p>
        </div>
      )}

      {/* ── Secciones del módulo ───────────────────────────────────────── */}
      <div className="inline-flex flex-wrap rounded-lg bg-surface-low p-0.5">
        {SECCIONES.map(s => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer',
              seccion === s.id
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {s.et}
          </button>
        ))}
      </div>

      {/* Solo estorba en las tablas, que siempre muestran los doce meses. */}
      {seccion !== 'resumen' && <AvisoSoloLectura visible={datos ? !datos.edicion : false} />}

      {/* ── Filtro por periodo ─────────────────────────────────────────── */}
      {seccion === 'resumen' && analisis && analisis.mesesDisponibles.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg bg-surface-low p-0.5">
            {PRESETS.map(p => {
              const rango = rangoDePreset(p, analisis.mesesDisponibles)
              const inutil = !rango || ('ventana' in p && analisis.mesesDisponibles.length <= p.ventana)
              const activo = rango && (p.id === 'todo'
                ? analisis.rangoCompleto
                : !analisis.rangoCompleto && rango.desde === analisis.primerMes && rango.hasta === analisis.ultimoMes)
              return (
                <button
                  key={p.id}
                  disabled={!!inutil}
                  onClick={() => { if (rango) { setDesde(rango.desde); setHasta(rango.hasta) } }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors',
                    inutil ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer',
                    activo
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {p.et}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {([['Desde', analisis.primerMes, setDesde], ['Hasta', analisis.ultimoMes, setHasta]] as const).map(
              ([et, valor, set]) => (
                <label key={et} className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-on-surface-variant">{et}</span>
                  <select
                    value={valor}
                    onChange={e => {
                      const v = Number(e.target.value)
                      set(v)
                      // Si se cruzan, el otro extremo se arrastra para no dejar un rango vacío.
                      if (et === 'Desde' && analisis.ultimoMes < v) setHasta(v)
                      if (et === 'Hasta' && analisis.primerMes > v) setDesde(v)
                    }}
                    className="px-2 py-1.5 rounded-lg bg-surface-low border border-surface-high text-[12.5px] font-medium text-on-surface cursor-pointer"
                  >
                    {analisis.mesesDisponibles.map(i => (
                      <option key={i} value={i}>{MESES_CORTOS[i]}</option>
                    ))}
                  </select>
                </label>
              ),
            )}
          </div>
        </div>
      )}

      {seccion === 'resumen' && (analisis?.filtradoPorCategoria || (analisis && !analisis.rangoCompleto)) && (
        <div className="card p-3 border-l-2 border-l-amber-500">
          <p className="text-[12.5px] text-on-surface">
            Vista filtrada
            {!analisis!.rangoCompleto && `: solo ${etiquetaPeriodo(analisis!)} (${analisis!.mesesActivos.length} de ${analisis!.mesesDisponibles.length} meses con dato)`}
            {analisis!.filtradoPorCategoria && `${!analisis!.rangoCompleto ? ' y ' : ': '}${apagadas.size} ${apagadas.size === 1 ? 'categoría' : 'categorías'} fuera del cálculo`}
            . Las cifras no son el gasto completo del año.
          </p>
        </div>
      )}

      {seccion === 'resumen' && (<>
      {/* ── Indicadores ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <TarjetaKPI
          etiqueta={analisis?.rangoCompleto ? 'Gasto acumulado' : 'Gasto del periodo'}
          valor={analisis?.total ?? 0}
          variacion={analisis?.deltaAnual ?? undefined}
          nota={analisis ? `${etiquetaPeriodo(analisis)} · ${analisis.mesesActivos.length} ${analisis.mesesActivos.length === 1 ? 'mes' : 'meses'}` : undefined}
          cargando={isLoading}
        />
        <TarjetaKPI
          etiqueta={`Mismo periodo ${anioPrevio ?? ''}`}
          valor={analisis?.totalPrevio ?? 0}
          nota={analisis?.totalPrevio == null ? 'sin año anterior cargado' : 'base de comparación'}
          cargando={isLoading}
        />
        <TarjetaKPI
          etiqueta="Promedio por mes"
          valor={analisis?.promedio ?? 0}
          nota={analisis ? `sobre los ${analisis.mesesActivos.length} meses con dato` : undefined}
          cargando={isLoading}
        />
        <TarjetaKPI
          // Proyectar el año desde un rango parcial ignoraría meses que ya tienen
          // dato, así que ahí se presenta como ritmo, no como cierre.
          etiqueta={
            analisis && !analisis.rangoCompleto ? 'Ritmo anualizado'
              : analisis && analisis.mesesActivos.length >= 12 ? 'Total del año'
                : 'Cierre proyectado'
          }
          valor={analisis && analisis.mesesActivos.length >= 12 && analisis.rangoCompleto
            ? analisis.total
            : analisis?.ritmoAnualizado ?? 0}
          variacion={analisis?.deltaProyeccion ?? undefined}
          nota={
            analisis && !analisis.rangoCompleto
              ? `si los 12 meses fueran como ${etiquetaPeriodo(analisis).toLowerCase()}`
              : analisis?.totalAnioPrevio != null
                ? `contra ${formatCOP(analisis.totalAnioPrevio)} de ${anioPrevio}`
                : 'proyección lineal'
          }
          cargando={isLoading}
        />
        <TarjetaKPI
          etiqueta="Nómina del corte"
          valor={datos?.nomina.resumen.montoPagado ?? 0}
          nota={datos
            ? `${datos.nomina.resumen.pagados} de ${datos.nomina.resumen.total} pagados · ${datos.nomina.resumen.pendientes} pendientes`
            : undefined}
          cargando={isLoading}
        />
      </div>

      {/* ── Gasto mensual por categoría ────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface">Gasto mensual por categoría</h3>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5">
              Toca una categoría para sacarla del cálculo: todo el panel se recalcula.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-[300px] rounded bg-surface-high animate-pulse mt-4" />
        ) : !analisis || serieApilada.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-12">Sin gasto registrado en este periodo</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 my-3">
              {datos!.anios[anioActivo!].categorias.map((c, i) => {
                const encendida = !apagadas.has(c.clave)
                return (
                  <button
                    key={c.clave}
                    onClick={() => alternarCategoria(c.clave)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-opacity cursor-pointer',
                      encendida
                        ? 'border-surface-high text-on-surface'
                        : 'border-surface-high text-on-surface-variant opacity-45 line-through',
                    )}
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: colorCategoria(c.clave, i) }} />
                    {c.nombre}
                  </button>
                )
              })}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serieApilada} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--surface-high)" vertical={false} />
                <XAxis
                  dataKey="mes" tickLine={false}
                  axisLine={{ stroke: 'var(--surface-high)' }}
                  tick={{ fontSize: 10.5, fill: 'var(--on-surface-variant)' }}
                />
                <YAxis
                  tickLine={false} axisLine={false} width={52}
                  tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                  tickFormatter={corto}
                />
                <Tooltip content={<Globo />} cursor={{ fill: 'var(--surface-high)', fillOpacity: 0.45 }} />
                {analisis.categorias.map((c, i) => (
                  <Bar
                    key={c.clave} dataKey={c.clave} name={c.nombre} stackId="gasto"
                    fill={colorCategoria(c.clave, i)}
                    radius={i === analisis.categorias.length - 1 ? [4, 4, 0, 0] : undefined}
                    maxBarSize={46}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Año contra año ───────────────────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface">
            {anioPrevio && analisis?.previoPorMes ? `${anioActivo} contra ${anioPrevio}` : `Gasto mensual ${anioActivo ?? ''}`}
          </h3>
          <p className="text-[11.5px] text-on-surface-variant mt-0.5">
            {analisis?.deltaAnual != null
              ? `En el periodo el gasto está ${pct(analisis.deltaAnual)} frente al mismo tramo de ${anioPrevio}.`
              : 'Gasto mensual del año.'}
          </p>

          <div className="flex items-center gap-4 flex-wrap mt-3 mb-1">
            <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
              <span className="w-4 h-[2.5px] rounded-full" style={{ background: 'var(--primary)' }} />
              {anioActivo}
            </span>
            {analisis?.previoPorMes && (
              <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
                <span className="w-4 h-[2px] rounded-full" style={{ background: '#94a3b8' }} />
                {anioPrevio}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="h-[260px] rounded bg-surface-high animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={serieAnual} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--surface-high)" vertical={false} />
                <XAxis
                  dataKey="mes" tickLine={false}
                  axisLine={{ stroke: 'var(--surface-high)' }}
                  tick={{ fontSize: 10.5, fill: 'var(--on-surface-variant)' }}
                />
                <YAxis
                  tickLine={false} axisLine={false} width={52}
                  tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                  tickFormatter={corto}
                />
                <Tooltip content={<Globo />} cursor={{ stroke: 'var(--surface-high)' }} />
                {/* `connectNulls` queda en falso a propósito: el año en curso no
                    tiene los meses que faltan y unirlos dibujaría una caída a cero. */}
                <Line
                  type="monotone" dataKey="actual" name={String(anioActivo)}
                  stroke="var(--primary)" strokeWidth={2.5}
                  dot={{ r: 2.5, fill: 'var(--primary)' }}
                  activeDot={{ r: 4 }} connectNulls={false}
                />
                {analisis?.previoPorMes && (
                  <Line
                    type="monotone" dataKey="previo" name={String(anioPrevio)}
                    stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4"
                    dot={false} activeDot={{ r: 4 }} connectNulls={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Participación por categoría ──────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface mb-1">Participación y variación</h3>
          <p className="text-[11.5px] text-on-surface-variant mb-3">
            Peso de cada categoría en el periodo y cómo se movió contra {anioPrevio}.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-6 rounded bg-surface-high animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-surface-high">
              {analisis?.categorias.map((c, i) => (
                <div key={c.clave}>
                  <FilaParticipacion
                    nombre={c.nombre}
                    monto={formatCOP(c.total)}
                    participacion={c.participacion}
                    proporcion={c.total / mayorCategoria}
                    color={colorCategoria(c.clave, i)}
                  />
                  <div className="flex items-center gap-2 pb-2 -mt-1">
                    <span className={cn(
                      'text-[9.5px] px-1.5 py-0.5 rounded-full font-medium',
                      ESTILO_TENDENCIA[c.tendencia],
                    )}>
                      {c.tendencia}
                    </span>
                    <Variacion valor={c.delta} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Observaciones ──────────────────────────────────────────────── */}
      {analisis && analisis.observaciones.length > 0 && (
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface">Observaciones</h3>
          <p className="text-[11.5px] text-on-surface-variant mt-0.5 mb-4">
            Lecturas calculadas sobre el periodo filtrado, no texto fijo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {analisis.observaciones.map((o, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface-low p-3.5 border-l-2"
                style={{ borderLeftColor: BORDE_TONO[o.tono] }}
              >
                <p className="text-[12.5px] font-semibold text-on-surface leading-snug">{o.titulo}</p>
                <p className="text-[11.5px] text-on-surface-variant mt-1 leading-relaxed">{o.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Producción y costo por pieza ───────────────────────────────── */}
      {analisis?.eficiencia && serieProduccion.length > 0 && (
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface">Producción y costo por pieza</h3>
          <p className="text-[11.5px] text-on-surface-variant mt-0.5 mb-3">
            Barras: piezas producidas. Línea: cuánto cuesta cada pieza, con Videos y Edición divididos entre las piezas del mes.
          </p>

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={serieProduccion} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--surface-high)" vertical={false} />
              <XAxis
                dataKey="mes" tickLine={false}
                axisLine={{ stroke: 'var(--surface-high)' }}
                tick={{ fontSize: 10.5, fill: 'var(--on-surface-variant)' }}
              />
              <YAxis
                yAxisId="piezas" tickLine={false} axisLine={false} width={38}
                tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
              />
              <YAxis
                yAxisId="costo" orientation="right" tickLine={false} axisLine={false} width={52}
                tick={{ fontSize: 10, fill: '#db2777' }}
                tickFormatter={corto}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-high)', fillOpacity: 0.45 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as { piezas: number; costo: number | null; horas: number | null }
                  return (
                    <div className="rounded-xl border border-surface-high bg-surface-container-lowest shadow-lg px-3 py-2.5 min-w-[190px]">
                      <p className="text-[11.5px] font-semibold text-on-surface mb-1.5">{String(label)}</p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11.5px] text-on-surface-variant">Piezas</span>
                        <span className="text-[12px] font-semibold tabular-nums text-on-surface">{numero(d.piezas)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11.5px] text-on-surface-variant">Costo por pieza</span>
                        <span className="text-[12px] tabular-nums text-on-surface">
                          {d.costo != null ? formatCOP(d.costo) : '—'}
                        </span>
                      </div>
                      {d.horas != null && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[11.5px] text-on-surface-variant">Horas profesionales</span>
                          <span className="text-[12px] tabular-nums text-on-surface">{numero(d.horas)}</span>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              <Bar yAxisId="piezas" dataKey="piezas" name="Piezas" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={38} />
              <Line
                yAxisId="costo" type="monotone" dataKey="costo" name="Costo por pieza"
                stroke="#db2777" strokeWidth={2.5} dot={{ r: 2.5, fill: '#db2777' }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-surface-high">
            {[
              { t: 'Piezas del periodo', v: numero(analisis.eficiencia.piezasTotal) },
              { t: 'Videos y Edición', v: formatCOP(analisis.eficiencia.gastoTotal) },
              { t: 'Costo promedio', v: analisis.eficiencia.costoPromedio != null ? formatCOP(analisis.eficiencia.costoPromedio) : '—' },
              {
                t: 'Horas profesionales',
                v: numero(analisis.eficiencia.mesesConPiezas.reduce(
                  (a, i) => a + (analisis.eficiencia!.horasPorMes[i] ?? 0), 0)),
              },
            ].map(x => (
              <div key={x.t}>
                <p className="text-[10.5px] text-on-surface-variant leading-tight">{x.t}</p>
                <p className="text-[13px] font-semibold tabular-nums text-on-surface mt-0.5">{x.v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cuentas y calidad del dato ─────────────────────────────────── */}
      {datos && datos.nomina.personas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* La nómina detallada vive en su propia pestaña, donde además se edita */}
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold text-on-surface mb-1">Cuentas por banco</h3>
              <p className="text-[11.5px] text-on-surface-variant mb-3">
                {datos.cuentas.total} cuentas en el directorio del sheet.
              </p>
              <div className="divide-y divide-surface-high">
                {datos.cuentas.porBanco.map((b, i) => (
                  <FilaParticipacion
                    key={b.banco}
                    nombre={b.banco}
                    monto={numero(b.cuentas)}
                    participacion={datos.cuentas.total ? b.cuentas / datos.cuentas.total : 0}
                    proporcion={b.cuentas / Math.max(...datos.cuentas.porBanco.map(x => x.cuentas), 1)}
                    color={colorCategoria(`banco-${i}`, i)}
                  />
                ))}
              </div>
            </div>

            {analisis && analisis.calidad.length > 0 && (
              <div className="card p-5">
                <h3 className="text-[15px] font-semibold text-on-surface mb-1">Calidad del dato</h3>
                <p className="text-[11.5px] text-on-surface-variant mb-3">
                  Lo que el sheet todavía no permite afirmar.
                </p>
                <div className="space-y-2">
                  {analisis.calidad.map((c, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className={cn(
                        'text-[9.5px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 mt-0.5',
                        c.nivel === 'alto' ? 'bg-rose-500/12 text-rose-600'
                          : c.nivel === 'medio' ? 'bg-amber-500/12 text-amber-600'
                            : 'bg-surface-high text-on-surface-variant',
                      )}>
                        {c.nivel === 'alto' ? 'Revisar' : c.nivel === 'medio' ? 'Ojo' : 'Nota'}
                      </span>
                      <p className="text-[11.5px] text-on-surface-variant leading-relaxed">{c.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
      </>)}

      {/* ── Tablas que se diligencian ──────────────────────────────────── */}
      {datos && seccion === 'contabilidad' && anioActivo && (
        <TablaContabilidad datos={datos} anio={anioActivo} editable={!!datos.edicion} />
      )}
      {datos && seccion === 'nomina' && (
        <TablaNomina datos={datos} editable={!!datos.edicion} />
      )}
      {datos && seccion === 'produccion' && (
        <TablaProduccion datos={datos} editable={!!datos.edicion} />
      )}
      {datos && seccion === 'tarifario' && (
        <TablaTarifario datos={datos} editable={!!datos.edicion} />
      )}

      {isLoading && seccion !== 'resumen' && (
        <div className="card p-5">
          <div className="h-64 rounded bg-surface-high animate-pulse" />
        </div>
      )}

      {datos && (
        <p className="text-[10.5px] text-on-surface-variant/80 text-center">
          Leído del Google Sheet de contabilidad el{' '}
          {new Date(datos.leidoEn).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          {' · '}
          <a
            href="https://gastosagencia.grupo500educacion.co"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            tablero con vista 3D <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      )}
    </div>
  )
}
