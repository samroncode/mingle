/** The secret host link. The key sits in the fragment so it never reaches a server. */
export function hostLink(origin: string, code: string, key: string): string {
  return `${origin}/host/${code}#key=${key}`;
}

/** The address to open on the TV. */
export function tvAddress(origin: string, code: string): string {
  return `${origin}/tv/${code}`;
}
