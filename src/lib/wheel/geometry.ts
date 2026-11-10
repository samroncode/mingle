/** How long the wheel takes to slow down and stop on the TV. */
export const spinDurationMs = 6000;

/** Full turns every spin makes before it settles, so a spin always looks like one. */
export const minimumTurns = 5;

/** Where inside a wedge the pointer may land, as a share of its width. */
const landing = { from: 0.15, to: 0.85 } as const;

/**
 * One wedge. Angles are degrees clockwise from straight up, where the pointer
 * is; wedge 0 starts there.
 */
export interface Wedge {
  index: number;
  start: number;
  end: number;
  middle: number;
}

/** The wedges of a wheel with `count` equally large entries. */
export function wedges(count: number): Wedge[] {
  const size = 360 / count;
  return Array.from({ length: count }, (_, index) => ({
    index,
    start: index * size,
    end: (index + 1) * size,
    middle: (index + 0.5) * size,
  }));
}

/** A random place inside a wedge, 0 to 1, kept away from the edges. */
export function randomOffset(random: () => number = Math.random): number {
  return landing.from + random() * (landing.to - landing.from);
}

export interface FinalRotationInput {
  /** Entries on the wheel as it spins. */
  count: number;
  /** Index of the drawn entry. */
  winnerIndex: number;
  /** Where the wheel stands now, in degrees; never turns backwards from it. */
  currentRotation?: number;
  /** Where inside the winner's wedge the pointer lands, 0 to 1. */
  offset?: number;
  turns?: number;
}

/**
 * The rotation (degrees, clockwise, always forward from `currentRotation`) at
 * which the pointer rests inside the winner's wedge.
 */
export function finalRotation({
  count,
  winnerIndex,
  currentRotation = 0,
  offset = 0.5,
  turns = minimumTurns,
}: FinalRotationInput): number {
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= count)
    throw new RangeError("The winner is not on the wheel");
  const inside = Math.min(Math.max(offset, 0), 1);
  const target = (winnerIndex + inside) * (360 / count);
  const rest = (((360 - target - currentRotation) % 360) + 360) % 360;
  return currentRotation + turns * 360 + rest;
}

/** The index of the wedge under the pointer when the wheel stands at `rotation`. */
export function wedgeUnderPointer(count: number, rotation: number): number {
  const angle = (((360 - rotation) % 360) + 360) % 360;
  return Math.min(Math.floor(angle / (360 / count)), count - 1);
}

/** The longest label a wedge shows, by how many wedges share the wheel. */
export function labelLimit(count: number): number {
  if (count <= 8) return 14;
  if (count <= 16) return 11;
  return 8;
}

/** `label` cut to `max` characters, with an ellipsis when something was cut. */
export function truncateLabel(label: string, max: number): string {
  const chars = Array.from(label.trim());
  if (chars.length <= max) return chars.join("");
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

/** SVG path of one wedge of a circle around (0, 0), in degrees from straight up. */
export function wedgePath(radius: number, start: number, end: number): string {
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return [radius * Math.sin(radians), -radius * Math.cos(radians)] as const;
  };
  const [x0, y0] = point(start);
  const [x1, y1] = point(end);
  const large = end - start > 180 ? 1 : 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return `M0 0L${round(x0)} ${round(y0)}A${radius} ${radius} 0 ${large} 1 ${round(x1)} ${round(y1)}Z`;
}
