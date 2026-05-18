import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-row items-center justify-between gap-3', className)}>
      <div>
        <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-white/70 mt-0.5 font-medium">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}
