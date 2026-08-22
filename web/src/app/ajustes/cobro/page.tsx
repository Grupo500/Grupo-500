'use client'

/**
 * Datos de cobro: lo que va en la cuenta de cobro de cada freelance. Sin los
 * obligatorios (nombre completo, cédula, banco y número de cuenta) el sábado
 * su cuenta no sale —y es plata que no recibe esa semana—, así que aquí se
 * dice cuánto falta y qué, antes del formulario.
 */

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { DatosFinancieros, type Financieros } from '@/components/marketing/DatosFinancieros'

interface MiCuenta { esMarketing: boolean; financieros: Financieros | null }

const OBLIGATORIOS: { clave: keyof Financieros; nombre: string }[] = [
  { clave: 'nombreCompleto', nombre: 'nombre completo' },
  { clave: 'cedula',         nombre: 'cédula' },
  { clave: 'banco',          nombre: 'banco' },
  { clave: 'numeroCuenta',   nombre: 'número de cuenta' },
]

export default function CobroPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['mi-cuenta'],
    queryFn: () => apiFetch<{ data: MiCuenta }>('/auth/me'),
  })
  const cuenta = data?.data

  if (isLoading) return <div className="flex justify-center py-16 text-on-surface-variant"><Loader2 className="size-5 animate-spin" /></div>
  if (!cuenta?.esMarketing || !cuenta.financieros) {
    return <p className="rounded-2xl border border-outline-variant bg-surface-lowest p-5 text-[13px] text-on-surface-variant">Esta sección es para el equipo de marketing que cobra freelance.</p>
  }

  const f = cuenta.financieros
  const faltan = OBLIGATORIOS.filter(o => !String(f[o.clave] ?? '').trim()).map(o => o.nombre)
  const total = Object.keys(f).length
  const llenos = Object.values(f).filter(v => v !== null && String(v).trim() !== '').length

  return (
    <>
      {faltan.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-relaxed text-[#92400e]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span><b className="font-semibold">Te falta{faltan.length !== 1 ? 'n' : ''} {faltan.length} dato{faltan.length !== 1 ? 's' : ''} obligatorio{faltan.length !== 1 ? 's' : ''}</b> ({faltan.join(', ')}). Sin eso, el sábado tu cuenta de cobro no sale y te quedas sin pago esa semana.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12.5px] text-[#166534]">
          <CheckCircle2 className="size-4 shrink-0" />
          <span><b className="font-semibold">Datos completos.</b> Tu cuenta de cobro sale cada sábado con lo que te aprueben.</span>
        </div>
      )}
      <p className="flex items-center gap-3 px-1 text-[12px] text-on-surface-variant">
        <span className="h-1.5 w-40 overflow-hidden rounded-full bg-outline-variant"><span className="block h-full rounded-full bg-[#16a34a]" style={{ width: `${Math.round((llenos / Math.max(1, total)) * 100)}%` }} /></span>
        {llenos} de {total} datos
      </p>
      <DatosFinancieros inicial={f} />
    </>
  )
}
