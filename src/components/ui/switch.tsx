import * as React from "react";
import { cn } from "cn";
import { Check, X } from "lucide-react";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-8 w-14 shrink-0 items-center rounded-pill border-[length:var(--border-chunky)] border-edge shadow-pop-sm transition-colors outline-none after:absolute after:-inset-2 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-sage data-[state=unchecked]:bg-line-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="group/thumb pointer-events-none flex size-6 items-center justify-center rounded-pill border-[length:var(--border-thin)] border-edge bg-paper text-on-paper transition-transform duration-(--duration-base) ease-(--ease-bounce) data-[state=checked]:translate-x-[25px] data-[state=unchecked]:translate-x-[2px]"
      >
        <Check
          aria-hidden
          strokeWidth={3}
          className="hidden size-4 group-data-[state=checked]/thumb:block"
        />
        <X
          aria-hidden
          strokeWidth={3}
          className="size-4 group-data-[state=checked]/thumb:hidden"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
