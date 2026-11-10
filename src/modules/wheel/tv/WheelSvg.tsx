import {
  labelLimit,
  truncateLabel,
  wedgePath,
  wedges,
} from "@/lib/wheel/geometry";

/** Wedge fills, written out so Tailwind finds each class. They are theme tokens. */
const fills = [
  "fill-coral",
  "fill-champagne",
  "fill-blush",
  "fill-sage",
] as const;

/** The wedge after the last one must differ from the first when the cycle wraps. */
function fillFor(index: number, count: number): string {
  if (index === count - 1 && count > 1 && index % fills.length === 0)
    return "fill-coral-soft";
  return fills[index % fills.length] ?? "fill-coral";
}

const radius = 480;

interface WheelSvgProps {
  /** One label per wedge, in order. */
  labels: string[];
  /** Degrees clockwise; 0 has the first wedge starting at the pointer. */
  rotation: number;
  durationMs: number;
  label: string;
}

/**
 * The wheel: one wedge per label, a pointer at the top, and a hub. Only the
 * wedges turn; the pointer stays. Colors are the theme's tokens.
 */
export function WheelSvg({
  labels,
  rotation,
  durationMs,
  label,
}: WheelSvgProps) {
  const count = labels.length;
  const fontSize = count <= 8 ? 54 : count <= 16 ? 42 : 34;
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="wheel-svg"
      viewBox="-500 -540 1000 1040"
      className="h-full max-h-full w-auto"
    >
      <g
        data-testid="wheel-disc"
        data-rotation={rotation}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition:
            durationMs > 0
              ? `transform ${durationMs}ms cubic-bezier(0.1, 0.55, 0.15, 1)`
              : "none",
        }}
      >
        {wedges(count).map((wedge) => (
          <g key={wedge.index}>
            {count === 1 ? (
              <circle r={radius} className={fillFor(0, 1)} />
            ) : (
              <path
                d={wedgePath(radius, wedge.start, wedge.end)}
                className={`${fillFor(wedge.index, count)} stroke-edge`}
                strokeWidth={4}
              />
            )}
            <text
              transform={`rotate(${wedge.middle - 90})`}
              x={radius - 36}
              dy="0.35em"
              textAnchor="end"
              fontSize={fontSize}
              className="fill-on-bright font-display font-extrabold"
            >
              {truncateLabel(labels[wedge.index] ?? "", labelLimit(count))}
            </text>
          </g>
        ))}
        <circle r={radius} className="fill-none stroke-edge" strokeWidth={10} />
      </g>
      <circle r={44} className="fill-paper stroke-edge" strokeWidth={8} />
      <path
        d="M-34 -530L34 -530L0 -450Z"
        className="fill-coral-text stroke-edge"
        strokeWidth={8}
        strokeLinejoin="round"
      />
    </svg>
  );
}
