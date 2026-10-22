/** The path of the secret host link. The key sits in the fragment so it never reaches a server. */
export function hostPath(code: string, key: string): string {
  return `/host/${code}#key=${key}`;
}

/** The secret host link, as a full address to copy or share. */
export function hostLink(origin: string, code: string, key: string): string {
  return `${origin}${hostPath(code, key)}`;
}

/** The address guests open to join; the join QR code holds it. */
export function guestAddress(origin: string, code: string): string {
  return `${origin}/p/${code}`;
}

/** Cleans up a typed join code: no spaces, upper case. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** The address to open on the TV. */
export function tvAddress(origin: string, code: string): string {
  return `${origin}/tv/${code}`;
}
