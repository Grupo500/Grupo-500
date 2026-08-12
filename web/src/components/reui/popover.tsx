// Popover para el Event Calendar de ReUI — ver la nota en ./button.tsx.
//
// El calendario espera el contrato de Base UI: `render` en el Trigger y un
// `onOpenChange(abierto, detalles)` de dos argumentos. El de Radix pasa uno
// solo, y por eso el "+N más" del mes no compilaba.

"use client"

import * as React from "react"
import { Popover as BasePopover } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

const Popover = BasePopover.Root
const PopoverTrigger = BasePopover.Trigger

function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof BasePopover.Popup> & {
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} sideOffset={sideOffset}>
        <BasePopover.Popup
          className={cn(
            "z-50 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none",
            "transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
