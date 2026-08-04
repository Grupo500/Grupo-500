'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { formatCOP } from '@/lib/utils'
import { Search, Phone } from 'lucide-react'

interface FilaCuota {
  estudianteId: string
  nombre: string
  telefono: string
  email: string
  asesor: string | null
  curso: string
  cuotaNumero: number
  cuotasTotal: number
  montoCuota: number
  totalCurso: number
  totalPagado: number
  saldo: number
  metodo: string
  fechaUltimaCuota: string | null
  diasSinPagar: number | null
  proximaCuotaEstimada: string | null
  estado: 'al-dia' | 'atrasado' | 'completado'
}

interface CuotasData {
  resumen: { total: number; atrasados: number; alDia: number; completados: number; saldoTotal: number }
  filas: FilaCuota[]
}

const ESTADO_LABEL: Record<FilaCuota['estado'], string> = { 'al-dia': 'Al día', atrasado: 'Atrasado', completado: 'Completado' }
const ESTADO_COLOR: Record<FilaCuota['estado'], string> = { 'al-dia': '#1a7de0', atrasado: '#dc2626', completado: '#16a34a' }

function numero(v: number) { return Math.round(v).toLocaleString('es-CO') }

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CuotasPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [asesor, setAsesor] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-cuotas'],
    queryFn: async () => apiFetch('/reportes/cuotas') as Promise<{ data: CuotasData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const asesores = useMemo(
    () => [...new Set((d?.filas ?? []).map(f => f.asesor).filter((a): a is string => !!a))].sort(),
    [d?.filas],
  )

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (d?.filas ?? []).filter(f =>
      (!estado || f.estado === estado) &&
      (!isAdmin || !asesor || f.asesor === asesor) &&
      (!texto || f.nombre.toLowerCase().includes(texto) || f.curso.toLowerCase().includes(texto))
    )
  }, [d?.filas, busqueda, estado, asesor, isAdmin])

  const r = d?.resumen

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Control de cuotas"
        subtitle={isAdmin
          ? 'Ventas a cuotas de Hotmart (Smart Installment) de todo el equipo: cuánto va pagado y quién se atrasó'
          : 'Tus ventas a cuotas de Hotmart (Smart Installment): cuánto va pagado y quién se atrasó'}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { e: 'En plan de cuotas', v: numero(r?.total ?? 0) },
          { e: 'Atrasados', v: numero(r?.atrasados ?? 0), color: '#dc2626' },
          { e: 'Al día', v: numero(r?.alDia ?? 0), color: '#1a7de0' },
          { e: 'Completados', v: numero(r?.completados ?? 0), color: '#16a34a' },
          { e: 'Saldo pendiente', v: formatCOP(r?.saldoTotal ?? 0) },
        ].map(k => (
          <div key={k.e} className="card p-4">
            <p className="text-[11.5px] font-medium text-on-surface-variant">{k.e}</p>
            <p className="text-[20px] font-bold tabular-nums mt-1" style={{ color: k.color ?? 'var(--on-surface)' }}>
              {isLoading ? '—' : k.v}
            </p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-[15px] font-semibold text-on-surface">Detalle por estudiante</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={estado}
              onValueChange={setEstado}
              className="w-[160px]"
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'atrasado', label: 'Atrasado' },
                { value: 'al-dia', label: 'Al día' },
                { value: 'completado', label: 'Completado' },
              ]}
              anchoAuto
            />
            {isAdmin && (
              <Select
                value={asesor}
                onValueChange={setAsesor}
                className="w-[170px]"
                options={[{ value: '', label: 'Todos los asesores' }, ...asesores.map(a => ({ value: a, label: a }))]}
                anchoAuto
              />
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o curso"
                className="h-9 pl-8 pr-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary w-[220px]"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-9 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : filtradas.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-8">Nadie coincide con el filtro</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface-high">
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Estudiante</th>
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Curso</th>
                  {isAdmin && <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Asesor</th>}
                  <th className="px-2 py-2 text-center text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Cuota</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Pagado</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Saldo</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Última cuota</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Próxima cuota</th>
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Estado</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 150).map(f => (
                  <tr key={f.estudianteId + f.curso} className="border-b border-surface-high hover:bg-surface-low transition-colors">
                    <td className="px-2 py-2.5 min-w-[160px]">
                      <Link href={`/estudiantes/${f.estudianteId}`} className="text-[12.5px] font-medium text-on-surface hover:text-primary truncate block">
                        {f.nombre}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-[12px] text-on-surface-variant min-w-[200px] max-w-[320px] whitespace-normal leading-snug">{f.curso}</td>
                    {isAdmin && <td className="px-2 py-2.5 text-[12px] text-on-surface-variant whitespace-nowrap">{f.asesor ?? '—'}</td>}
                    <td className="px-2 py-2.5 text-center">
                      <span className="text-[11.5px] font-semibold tabular-nums text-on-surface whitespace-nowrap">
                        {f.cuotaNumero} de {f.cuotasTotal}
                      </span>
                      <div className="h-1 w-14 mx-auto mt-1 rounded-full bg-surface-high overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, (f.cuotaNumero / f.cuotasTotal) * 100)}%`, background: ESTADO_COLOR[f.estado] }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface whitespace-nowrap">{formatCOP(f.totalPagado)}</td>
                    <td className="px-2 py-2.5 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: f.saldo > 0 ? '#d97706' : 'var(--on-surface-variant)' }}>
                      {formatCOP(f.saldo)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface-variant whitespace-nowrap">
                      {fmtFecha(f.fechaUltimaCuota)}
                      {f.diasSinPagar != null && f.estado !== 'completado' && (
                        <p className="text-[10px] text-on-surface-variant/70">hace {f.diasSinPagar}d</p>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums whitespace-nowrap"
                      style={{ color: f.estado === 'atrasado' ? '#dc2626' : 'var(--on-surface-variant)' }}>
                      {f.estado === 'completado' ? '—' : fmtFecha(f.proximaCuotaEstimada)}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className="text-[10.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: `${ESTADO_COLOR[f.estado]}1f`, color: ESTADO_COLOR[f.estado] }}
                      >
                        {ESTADO_LABEL[f.estado]}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      {f.telefono && f.estado !== 'completado' && (
                        <a
                          href={`https://wa.me/57${f.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline whitespace-nowrap"
                        >
                          <Phone className="w-3 h-3" /> Contactar
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[11px] text-on-surface-variant mt-3">
              Mostrando {numero(Math.min(filtradas.length, 150))} de {numero(filtradas.length)} filtrados
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
