// Menú desplegable para el Event Calendar de ReUI — ver la nota en ./button.tsx.
//
// El calendario lo usa para el selector de vista (Mes / Semana / Día / Agenda)
// y espera el contrato de Base UI: `render` en el Trigger y `Group`/`GroupLabel`
// como partes propias.

"use client"

import * as React from "react"
import { Menu as BaseMenu } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

const DropdownMenu = BaseMenu.Root
const DropdownMenuTrigger = BaseMenu.Trigger
const DropdownMenuGroup = BaseMenu.Group

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof BaseMenu.Popup> & {
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <BaseMenu.Portal>
      {/* El z-index va en el Positioner, no en el Popup: es el Positioner el
          que Base UI posiciona en fixed, así que un z en el hijo no levanta
          el desplegable y termina saliendo por debajo del resto. Se usa la
          misma altura que el Select de la app (z-[10000]). */}
      <BaseMenu.Positioner align={align} sideOffset={sideOffset} className="z-[10000]">
        <BaseMenu.Popup
          className={cn(
            "min-w-[9rem] origin-[var(--transform-origin)] overflow-hidden rounded-xl border border-outline-variant bg-surface-lowest p-1 text-on-surface shadow-float outline-none",
            "transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseMenu.GroupLabel>) {
  return (
    <BaseMenu.GroupLabel
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
}
