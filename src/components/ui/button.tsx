import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * Chunky Kalas button: outline, hard shadow, and a bottom edge that collapses when pressed.
 * The shadow color and the fills come from theme tokens only.
 */
const buttonVariants = cva(
  "group/button fun-lift inline-flex shrink-0 items-center justify-center gap-2 rounded-md border-[length:var(--border-chunky)] border-edge font-display font-bold whitespace-nowrap select-none shadow-pop-sm transition-[transform,box-shadow,background-color] duration-(--duration-fast) outline-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-coral text-on-bright hover:brightness-105",
        accent: "bg-blush text-on-bright hover:brightness-105",
        secondary: "bg-paper text-on-paper hover:brightness-105",
        outline: "bg-paper text-on-paper hover:brightness-105",
        hype: "fun-pulse bg-champagne text-on-bright hover:brightness-105",
        destructive: "bg-danger text-on-bright hover:brightness-105",
        ghost:
          "border-transparent bg-transparent text-ink shadow-none hover:bg-surface-sunken active:translate-x-0 active:translate-y-0",
        link: "border-transparent bg-transparent text-link shadow-none underline-offset-4 hover:underline active:translate-x-0 active:translate-y-0",
      },
      size: {
        default: "min-h-12 px-4 text-base",
        sm: "min-h-12 px-3 text-sm",
        lg: "min-h-14 w-full px-6 text-lg",
        hype: "min-h-16 w-full px-8 text-2xl",
        icon: "size-12",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
