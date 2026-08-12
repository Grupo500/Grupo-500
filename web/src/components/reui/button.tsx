// Botón para el Event Calendar de ReUI.
//
// El calendario está escrito contra las primitivas propias de ReUI, que son de
// Base UI: usan la prop `render` para componer (en vez del `asChild` de Radix)
// y tienen el tamaño `icon-sm`. Esas primitivas están tras el plan de pago de
// ReUI, así que este archivo reproduce su contrato sobre @base-ui/react —el
// mismo motor que usan ellos— para no tener que parchear los 13 archivos del
// calendario, que así siguen actualizándose desde el registry sin tocarlos.
//
// Solo lo usa el calendario. El botón de la app es @/components/ui/Button.

"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2 [&_svg]:size-4",
        sm: "h-8 rounded-md px-3 [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 rounded-md [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

interface ButtonProps
  extends React.ComponentPropsWithRef<"button">,
    VariantProps<typeof buttonVariants> {
  /** Reemplaza el elemento renderizado (equivalente al `asChild` de Radix). */
  render?: useRender.RenderProp
}

function Button({ className, variant, size, render, ref, ...props }: ButtonProps) {
  return useRender({
    render: render ?? <button type="button" />,
    ref,
    props: mergeProps<"button">(
      { className: cn(buttonVariants({ variant, size }), className) },
      props,
    ),
  })
}

export { Button, buttonVariants }
export type { ButtonProps }
