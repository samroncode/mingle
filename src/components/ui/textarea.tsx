import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-md border-[length:var(--border-thin)] border-line-strong bg-surface-sunken px-3 py-2 text-base text-ink transition-colors outline-none placeholder:text-ink-muted focus-visible:border-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
