import { cn } from "@/lib/utils";

const pieces = [
  { left: "6%", fill: "bg-coral", delay: "0ms" },
  { left: "15%", fill: "bg-champagne", delay: "300ms" },
  { left: "24%", fill: "bg-blush", delay: "120ms" },
  { left: "33%", fill: "bg-sage", delay: "480ms" },
  { left: "42%", fill: "bg-coral", delay: "200ms" },
  { left: "51%", fill: "bg-champagne", delay: "560ms" },
  { left: "60%", fill: "bg-blush", delay: "80ms" },
  { left: "69%", fill: "bg-sage", delay: "360ms" },
  { left: "78%", fill: "bg-coral", delay: "520ms" },
  { left: "87%", fill: "bg-champagne", delay: "160ms" },
  { left: "94%", fill: "bg-blush", delay: "400ms" },
] as const;

/**
 * Confetti falling from the top of the nearest positioned parent. How often it
 * falls comes from the fun dial: once in playful, on a loop in party, never in
 * calm or reduced motion.
 */
export function Confetti() {
  return (
    <div
      aria-hidden
      data-testid="confetti"
      className="pointer-events-none absolute inset-x-0 top-0 h-0"
    >
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={cn(
            "fun-confetti absolute block h-5 w-3 rounded-sm",
            piece.fill,
          )}
          style={{ left: piece.left, animationDelay: piece.delay }}
        />
      ))}
    </div>
  );
}
