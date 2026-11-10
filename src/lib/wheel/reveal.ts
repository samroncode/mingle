import { spinDurationMs } from "./geometry";

/**
 * The same time as `spinDurationMs`, under the name the host view imports:
 * phones and the host's own screen show the winner once the TV has landed.
 */
export const SPIN_ANIMATION_MS = spinDurationMs;

/** A spin as far as the reveal cares: when the server recorded it. */
export interface TimedSpin {
  spunAt: string;
}

/** Milliseconds until the spin may be shown; 0 or less once it may. */
export function revealDelay(spin: TimedSpin, now: number): number {
  return Date.parse(spin.spunAt) + spinDurationMs - now;
}

/** The spins whose animation has finished at `now`, in the order given. */
export function revealedSpins<T extends TimedSpin>(
  spins: readonly T[],
  now: number,
): T[] {
  return spins.filter((spin) => revealDelay(spin, now) <= 0);
}

/** Milliseconds until the next hidden spin may be shown, or null if none. */
export function nextRevealIn(
  spins: readonly TimedSpin[],
  now: number,
): number | null {
  const waits = spins
    .map((spin) => revealDelay(spin, now))
    .filter((w) => w > 0);
  return waits.length === 0 ? null : Math.min(...waits);
}
