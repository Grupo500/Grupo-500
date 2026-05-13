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
  default: { icon: 'text-primary', bg: 'bg-primary/10', glow: '' },
  success: { icon: 'text-secondary', bg: 'bg-secondary/10', glow: 'shadow-glow-green' },
  warning: { icon: 'text-tertiary', bg: 'bg-tertiary/10', glow: 'shadow-glow-amber' },
  error:   { icon: 'text-error',    bg: 'bg-error/10',    glow: '' },
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', className }: KpiCardProps) {
  const v = variantMap[variant]
  const isPositive = (trend?.value ?? 0) >= 0

  return (
    <div className={cn('card p-5 flex flex-col gap-4 animate-fade-in', v.glow, className)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-md flex items-center justify-center', v.bg)}>
          <Icon className={cn('w-5 h-5', v.icon)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-label-md px-2 py-1 rounded-full',
            isPositive ? 'text-secondary bg-secondary/10' : 'text-error bg-error/10',
          )}>
            {isPositive
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-on-surface tabular leading-none">{value}</p>
        <p className="text-body-md text-on-surface-variant mt-1">{title}</p>
        {subtitle && <p className="text-label-md text-on-surface-variant/60 mt-0.5">{subtitle}</p>}
        {trend && <p className="text-label-md text-on-surface-variant/50 mt-1">{trend.label}</p>}
      </div>
    </div>
  )
}
