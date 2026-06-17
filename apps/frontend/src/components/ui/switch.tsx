import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "../../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[checked]:bg-primary data-[unchecked]:bg-input/40 dark:data-[unchecked]:bg-input/60 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        size === "default" && "h-[22px] w-[38px]",
        size === "sm" && "h-[18px] w-[30px]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform dark:data-[checked]:bg-primary-foreground dark:data-[unchecked]:bg-foreground",
          size === "default" && "size-[16px] data-[checked]:translate-x-[18px] data-[unchecked]:translate-x-[2px]",
          size === "sm" && "size-[12px] data-[checked]:translate-x-[14px] data-[unchecked]:translate-x-[2px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
