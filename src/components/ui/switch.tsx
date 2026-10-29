import * as React from "react";
import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-8 w-14 shrink-0 items-center rounded-pill border-[length:var(--border-chunky)] border-edge shadow-pop-sm transition-colors outline-none after:absolute after:-inset-2 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-sage data-[state=unchecked]:bg-surface-sunken",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-pill border-[length:var(--border-thin)] border-edge bg-paper transition-transform duration-(--duration-base) ease-(--ease-bounce) data-[state=checked]:translate-x-[26px] data-[state=unchecked]:translate-x-[2px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
