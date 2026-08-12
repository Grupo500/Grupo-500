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
      {/* z-index en el Positioner, no en el Popup — ver la nota en
          ./dropdown-menu.tsx. */}
      <BasePopover.Positioner align={align} sideOffset={sideOffset} className="z-[10000]">
        <BasePopover.Popup
          className={cn(
            "origin-[var(--transform-origin)] rounded-xl border border-outline-variant bg-surface-lowest p-2 text-on-surface shadow-float outline-none",
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
