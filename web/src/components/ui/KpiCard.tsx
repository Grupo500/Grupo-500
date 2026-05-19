'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title:      string
  value:      string
  rawValue?:  number          // número puro para animar con count-up
  subtitle?:  string
  icon:       LucideIcon
  trend?:     { value: number; label: string }
  variant?:   'default' | 'success' | 'warning' | 'error'
  isLoading?: boolean
  className?: string
  formatValue?: (n: number) => string  // formateador custom (ej: formatCOP)
}

const variantMap = {
  default: {
    icon:    'text-primary',
    bg:      'bg-[var(--primary-container)]',
    accent:  '#1a7de0',
  },
  success: {
    icon:    'text-secondary',
    bg:      'bg-[var(--secondary-container)]',
    accent:  '#16a34a',
  },
  warning: {
    icon:    'text-tertiary',
    bg:      'bg-[var(--tertiary-container)]',
    accent:  '#d97706',
  },
  error: {
    icon:    'text-[var(--error)]',
    bg:      'bg-[var(--error-container)]',
    accent:  '#dc2626',
  },
}

// ── Count-up animado ────────────────────────────────────────────────────────
function useCountUp(target: number, enabled: boolean, duration = 850) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!enabled || target === 0) { setCurrent(target); return }
    const startTime = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    setCurrent(0)
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration])

  return current
}

export function KpiCard({
  title, value, rawValue, subtitle, icon: Icon,
  trend, variant = 'default', isLoading = false,
  className, formatValue,
}: KpiCardProps) {
  const v          = variantMap[variant]
  const isPositive = (trend?.value ?? 0) >= 0
  const animated   = useCountUp(rawValue ?? 0, !isLoading && rawValue !== undefined)

  const displayValue = isLoading
    ? null
    : rawValue !== undefined
      ? (formatValue ? formatValue(animated) : String(animated))
      : value

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-surface-lowest border border-outline-variant/60 p-4 sm:p-5 flex flex-col gap-3',
        className,
      )}
      style={{ boxShadow: `0 2px 16px ${v.accent}10` }}
    >
      {/* Burbuja decorativa de fondo */}
      <div
        className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full opacity-[0.06] pointer-events-none"
        style={{ background: v.accent }}
      />

      {/* Header: ícono + badge trend */}
      <div className="flex items-start justify-between">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', v.bg)}>
          {isLoading
            ? <div className="w-4 h-4 rounded bg-[var(--surface-high)] animate-pulse" />
            : <Icon className={cn('w-4 h-4', v.icon)} />}
        </div>

        {trend && !isLoading && (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
            isPositive
              ? 'text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20'
              : 'text-[var(--error)] bg-[var(--error-container)] border border-[var(--error)]/20',
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : '-'}{Math.abs(trend.value)}%</span>
          </div>
        )}
        {trend && isLoading && (
          <div className="h-5 w-12 rounded-full bg-[var(--surface-high)] animate-pulse" />
        )}
      </div>

      {/* Valores */}
      <div>
        {isLoading ? (
          <>
            <div className="h-7 w-28 rounded-lg bg-[var(--surface-high)] animate-pulse mb-2" />
            <div className="h-3.5 w-20 rounded bg-[var(--surface-high)] animate-pulse" />
            {subtitle && <div className="h-3 w-16 rounded bg-[var(--surface-high)] animate-pulse mt-1.5" />}
          </>
        ) : (
          <>
            <p
              className="text-[22px] sm:text-[24px] font-bold tabular leading-none tracking-tight"
              style={{ color: v.accent, transition: 'color 200ms' }}
            >
              {displayValue}
            </p>
            <p className="text-[13px] font-semibold text-on-surface mt-1.5 leading-tight">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-on-surface-variant/70 mt-0.5 leading-tight">{subtitle}</p>
            )}
            {trend && (
              <p className="text-[10px] text-on-surface-variant/50 mt-1">{trend.label}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
