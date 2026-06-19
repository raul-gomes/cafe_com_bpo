import * as React from "react"
import { cn } from "../../lib/utils"

type BoxProps = React.ComponentProps<"div"> & {
  /** Internal padding. Default: p-4 (16px) */
  padding?: "none" | "sm" | "md" | "lg" | "xl"
}

const paddingMap = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
} as const

function Box({
  className,
  padding = "md",
  ...props
}: BoxProps) {
  return (
    <div
      data-slot="box"
      className={cn(
        "flex flex-col rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10",
        paddingMap[padding],
        className
      )}
      {...props}
    />
  )
}

export { Box }
export type { BoxProps }
