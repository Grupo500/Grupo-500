'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  placeholder?: string
}

export function Select({ value, onValueChange, options, className, placeholder }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm text-on-surface outline-none focus:border-primary transition-colors data-[placeholder]:text-on-surface-variant',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest shadow-float animate-fade-in"
          style={{ width: 'var(--radix-select-trigger-width)' }}
        >
          <SelectPrimitive.Viewport className="p-1 max-h-64">
            {options.map(opt => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex items-center gap-2 pl-7 pr-3 py-2 rounded-md text-sm text-on-surface cursor-pointer select-none outline-none data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:font-semibold"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center">
                  <Check className="w-3.5 h-3.5 text-primary" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
