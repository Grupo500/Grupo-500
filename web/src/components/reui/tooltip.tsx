// Tooltip para el Event Calendar de ReUI — ver la nota en ./button.tsx.
//
// El calendario espera el contrato de Base UI: `delay`/`closeDelay`/`timeout`
// en el Provider y la prop `render` en el Trigger. La versión de Radix que
// baja el CLI de shadcn no tiene ninguna de las cuatro.

"use client"

import * as React from "react"
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = BaseTooltip.Provider
const Tooltip = BaseTooltip.Root
const TooltipTrigger = BaseTooltip.Trigger

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Popup> & {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          className={cn(
            "z-50 max-w-xs origin-[var(--transform-origin)] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md",
            "transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
