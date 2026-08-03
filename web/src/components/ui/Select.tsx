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
  /**
   * Por defecto el panel copia el ancho del disparador. Con `anchoAuto` crece
   * hasta donde necesite la opción más larga (útil con nombres de curso de
   * varias líneas), sin bajar del ancho del disparador.
   */
  anchoAuto?: boolean
  /** Deja que las opciones largas ocupen varias líneas en vez de cortarse. */
  multilinea?: boolean
  disabled?: boolean
  id?: string
  /**
   * Estilos del panel desplegable. Necesario en superficies que no siguen el
   * tema de la app (la landing de inscripción es blanca siempre, así que el
   * panel no puede heredar los colores del modo oscuro).
   */
  contentClassName?: string
  itemClassName?: string
}

// Radix reserva la cadena vacía para "sin selección", así que una opción no
// puede valer ''. Como en la app abundan los `<option value="">Sin colegio</option>`,
// el componente traduce '' a un centinela por dentro y lo devuelve como ''
// al consumidor, que así no tiene que enterarse.
const VACIO = '__vacio__'

export function Select({
  value, onValueChange, options, className, placeholder, anchoAuto, multilinea, disabled, id,
  contentClassName, itemClassName,
}: SelectProps) {
  const hayOpcionVacia = options.some(o => o.value === '')

  return (
    <SelectPrimitive.Root
      value={value === '' && hayOpcionVacia ? VACIO : value}
      onValueChange={v => onValueChange(v === VACIO ? '' : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm text-on-surface outline-none focus:border-primary transition-colors data-[placeholder]:text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          className,
        )}
      >
        <span className="truncate text-left min-w-0">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            'z-[10000] overflow-hidden rounded-lg border border-outline-variant bg-surface-lowest shadow-float animate-fade-in',
            contentClassName,
          )}
          style={
            anchoAuto
              ? { minWidth: 'var(--radix-select-trigger-width)', maxWidth: 'min(420px, calc(100vw - 24px))' }
              : { width: 'var(--radix-select-trigger-width)' }
          }
        >
          <SelectPrimitive.Viewport className="p-1 max-h-[min(320px,60vh)] overflow-y-auto">
            {options.map(opt => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value === '' ? VACIO : opt.value}
                className={cn(
                  'relative flex items-center gap-2 pl-7 pr-3 py-2 rounded-md text-sm text-on-surface cursor-pointer select-none outline-none data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:font-semibold',
                  multilinea && 'items-start',
                  itemClassName,
                )}
              >
                <SelectPrimitive.ItemIndicator className={cn('absolute left-2 flex items-center', multilinea && 'top-2.5')}>
                  <Check className="w-3.5 h-3.5 text-primary" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>
                  <span className={cn('block min-w-0', multilinea ? 'whitespace-normal leading-snug' : 'truncate')}>
                    {opt.label}
                  </span>
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
