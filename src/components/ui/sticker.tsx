import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const stickerVariants = cva(
  "fun-tilt inline-flex items-center rounded-sm border-[length:var(--border-chunky)] border-edge px-2 py-0.5 font-display text-sm font-extrabold text-on-bright shadow-pop-sm",
  {
    variants: {
      color: {
        champagne: "bg-champagne",
        coral: "bg-coral",
        blush: "bg-blush",
        sage: "bg-sage",
      },
      lean: {
        left: "-rotate-2",
        right: "rotate-2",
      },
    },
    defaultVariants: { color: "champagne", lean: "right" },
  },
);

/** A small tilted label. Neighbors should alternate `lean`. */
function Sticker({
  className,
  color,
  lean,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof stickerVariants>) {
  return (
    <span
      data-slot="sticker"
      className={cn(stickerVariants({ color, lean }), className)}
      {...props}
    />
  );
}

export { Sticker, stickerVariants };
