const dots = [
  { left: "5%", top: "8%", size: "4rem", delay: "0s" },
  { left: "14%", top: "62%", size: "2.25rem", delay: "1.2s" },
  { left: "33%", top: "4%", size: "1.5rem", delay: "3s" },
  { left: "88%", top: "12%", size: "3rem", delay: "2.1s" },
  { left: "92%", top: "64%", size: "4.75rem", delay: "0.6s" },
  { left: "68%", top: "88%", size: "1.75rem", delay: "1.8s" },
] as const;

/**
 * Soft light dots behind an award, like the bokeh on a printed diploma. They
 * glow slowly in playful and party, and stay still in calm or reduced motion.
 */
export function AwardDots() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {dots.map((dot, index) => (
        <span
          key={index}
          className="award-dot absolute block rounded-full bg-award-glow blur-[3px]"
          style={{
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            animationDelay: dot.delay,
          }}
        />
      ))}
    </div>
  );
}
