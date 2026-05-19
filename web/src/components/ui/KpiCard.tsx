'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title:       string
  value:       string
  rawValue?:   number
  subtitle?:   string
  icon:        LucideIcon
  trend?:      { value: number; label: string }
  variant?:    'default' | 'success' | 'warning' | 'error'
  isLoading?:  boolean
  className?:  string
  formatValue?: (n: number) => string
}

const variantMap = {
  default: { icon: 'text-primary',          bg: 'bg-primary/10',          accent: '#1a7de0' },
  success: { icon: 'text-secondary',         bg: 'bg-secondary/10',        accent: '#16a34a' },
  warning: { icon: 'text-tertiary',          bg: 'bg-tertiary/10',         accent: '#d97706' },
  error:   { icon: 'text-[var(--error)]',    bg: 'bg-[var(--error)]/10',   accent: '#dc2626' },
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
        'relative bg-surface-lowest rounded-xl overflow-hidden flex flex-col p-4 gap-3 transition-shadow duration-200',
        className,
      )}
      style={{
        border:    `1px solid ${v.accent}22`,
        borderTop: `3px solid ${v.accent}`,
        boxShadow: `0 1px 8px ${v.accent}12`,
      }}
    >
      {/* Fila ícono + badge trend */}
      <div className="flex items-start justify-between">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', v.bg)}>
          {isLoading
            ? <div className="w-4 h-4 rounded bg-[var(--surface-high)] animate-pulse" />
            : <Icon className={cn('w-4 h-4', v.icon)} />}
        </div>

        {trend && !isLoading && (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
            isPositive
              ? 'text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20'
              : 'text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/20',
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
        {trend && isLoading && (
          <div className="h-5 w-12 rounded-full bg-[var(--surface-high)] animate-pulse" />
        )}
      </div>

      {/* Sublabel */}
      {isLoading
        ? <div className="h-3 w-20 rounded bg-[var(--surface-high)] animate-pulse" />
        : <p className="text-[11px] font-medium leading-none" style={{ color: `${v.accent}99` }}>
            {subtitle ?? title}
          </p>
      }

      {/* Valor grande con count-up */}
      {isLoading
        ? <div className="h-8 w-28 rounded-lg bg-[var(--surface-high)] animate-pulse" />
        : <p
            className="text-[28px] sm:text-[30px] font-bold tabular leading-none tracking-tight"
            style={{ color: v.accent }}
          >
            {displayValue}
          </p>
      }

      {/* Nombre + trend label */}
      <div className="border-t pt-2.5" style={{ borderColor: `${v.accent}18` }}>
        {isLoading
          ? <div className="h-3.5 w-24 rounded bg-[var(--surface-high)] animate-pulse" />
          : <>
              <p className="text-[12px] font-semibold text-on-surface leading-none">{title}</p>
              {trend && <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{trend.label}</p>}
            </>
        }
      </div>
    </div>
  )
}
