/** A small number that changes when the list of ids does, order aside. */
export function idsSignal(ids: readonly string[]): number {
  let hash = 0;
  for (const char of [...ids].sort().join(",")) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Whether to mark the bill as updated: the total has changed since the guest
 * last looked (or since it first appeared on this phone).
 */
export function isBillUpdated(
  seenTotal: number | null,
  total: number | null,
): boolean {
  return seenTotal !== null && total !== null && seenTotal !== total;
}
