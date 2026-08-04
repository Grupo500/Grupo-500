import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(d)
}

export function formatRelative(date: string | Date): string {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days === -1) return 'Ayer'
  if (days > 0) return `En ${days} días`
  return `Hace ${Math.abs(days)} días`
}

// Hotmart no reenvía un webhook por cada cuota de un Smart Installment — solo
// llega el primer cargo, y `cuotaNumero` se corrige después con la API de
// Hotmart. `monto` siempre es el valor de UNA cuota, no lo acumulado, así que
// hay que multiplicar por cuántas cuotas van pagadas.
export function montoPagadoPago(p: { monto: number; enPartes?: boolean; cuotaNumero?: number | null; cuotasTotal?: number | null }): number {
  if (p.enPartes && (p.cuotasTotal ?? 0) > 1) {
    return p.monto * (p.cuotaNumero ?? 1)
  }
  return p.monto
}

// Convierte un nombre de curso de MAYÚSCULAS a Tipo Título (genérico).
// Ej: "PREICFES CALENDARIO A S-3" → "Preicfes Calendario A S-3"
export function formatCurso(nombre: string): string {
  return nombre
    .split(' ')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}
