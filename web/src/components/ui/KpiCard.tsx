'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title:        string
  value:        string
  rawValue?:    number
  subtitle?:    string
  icon:         LucideIcon
  trend?:       { value: number; label: string }
  variant?:     'default' | 'success' | 'warning' | 'error'
  isLoading?:   boolean
  className?:   string
  formatValue?: (n: number) => string
}

const variantMap = {
  default: { icon: 'text-primary',         bg: '',  accent: '#1a7de0' },
  success: { icon: 'text-secondary',        bg: '',  accent: '#16a34a' },
  warning: { icon: 'text-tertiary',         bg: '',  accent: '#d97706' },
  error:   { icon: 'text-[var(--error)]',   bg: '',  accent: '#dc2626' },
}

// ── Count-up ────────────────────────────────────────────────────────────────
function useCountUp(target: number, enabled: boolean, duration = 850) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!enabled || target === 0) { setCurrent(target); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setCurrent(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
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
  const { accent } = variantMap[variant]
  const isPositive  = (trend?.value ?? 0) >= 0
  const animated    = useCountUp(rawValue ?? 0, !isLoading && rawValue !== undefined)

  const displayValue = isLoading
    ? null
    : rawValue !== undefined
      ? (formatValue ? formatValue(animated) : String(animated))
      : value

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-3.5 flex flex-col gap-0', className)}
      style={{
        background:  'var(--surface-lowest)',
        border:      '1.5px solid var(--outline-variant)',
        boxShadow:   '0 1px 4px rgba(0,0,0,0.04)',
        transition:  'box-shadow 200ms',
      }}
    >
      {/* Fila: ícono + título + badge trend */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18` }}
        >
          {isLoading
            ? <div className="w-4 h-4 rounded bg-[var(--surface-high)] animate-pulse" />
            : <Icon className="w-4 h-4" style={{ color: accent }} />}
        </div>

        {isLoading
          ? <div className="h-3.5 w-24 rounded bg-[var(--surface-high)] animate-pulse flex-1" />
          : <p className="text-[12px] sm:text-[13px] font-semibold text-on-surface leading-tight flex-1">{title}</p>}

        {/* Badge trend */}
        {trend && !isLoading && (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ml-auto flex-shrink-0',
            isPositive
              ? 'text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20'
              : 'text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/20',
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
        {trend && isLoading && (
          <div className="h-5 w-12 rounded-full bg-[var(--surface-high)] animate-pulse flex-shrink-0" />
        )}
      </div>

      {/* Valor animado */}
      {isLoading
        ? <div className="h-6 w-28 rounded-lg bg-[var(--surface-high)] animate-pulse mb-1" />
        : <p
            className="text-[16px] sm:text-[19px] font-bold tabular leading-tight"
            style={{ color: accent }}
          >
            {displayValue}
          </p>
      }

      {/* Sublabel */}
      {isLoading
        ? <div className="h-3 w-20 rounded bg-[var(--surface-high)] animate-pulse mt-1" />
        : (subtitle || trend) && (
            <p className="mt-0.5 text-[10px] text-on-surface-variant/60 leading-tight hidden sm:block">
              {subtitle ?? trend?.label}
            </p>
          )
      }
    </div>
  )
}
