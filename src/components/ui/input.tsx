import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-md border-[length:var(--border-thin)] border-line-strong bg-surface-sunken px-3 py-2 text-base text-ink transition-colors outline-none placeholder:text-ink-muted focus-visible:border-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
