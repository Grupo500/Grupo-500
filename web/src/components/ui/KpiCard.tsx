import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

const variantMap = {
  default: { icon: 'text-primary',    bg: 'bg-[var(--primary-container)]' },
  success: { icon: 'text-secondary',  bg: 'bg-[var(--secondary-container)]' },
  warning: { icon: 'text-tertiary',   bg: 'bg-[var(--tertiary-container)]' },
  error:   { icon: 'text-[var(--error)]', bg: 'bg-[var(--error-container)]' },
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', className }: KpiCardProps) {
  const v = variantMap[variant]
  const isPositive = (trend?.value ?? 0) >= 0

  return (
    <div className={cn('card p-5 flex flex-col gap-3 animate-fade-in', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-9 h-9 rounded-md flex items-center justify-center', v.bg)}>
          <Icon className={cn('w-4.5 h-4.5', v.icon)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
            isPositive
              ? 'text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20'
              : 'text-[var(--error)] bg-[var(--error-container)] border border-[var(--error)]/20',
          )}>
            {isPositive
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : '-'}{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-[22px] font-bold text-on-surface tabular leading-none tracking-tight">{value}</p>
        <p className="text-[13px] text-on-surface-variant mt-1 font-medium">{title}</p>
        {subtitle && <p className="text-[11px] text-on-surface-variant/60 mt-0.5">{subtitle}</p>}
        {trend && <p className="text-[11px] text-on-surface-variant/50 mt-1">{trend.label}</p>}
      </div>
    </div>
  )
}
