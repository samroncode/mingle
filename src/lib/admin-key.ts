// 32 random bytes, base64url-encoded without padding.
const ADMIN_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Reads the admin key from a URL fragment such as `#key=…`. */
export function readAdminKey(hash: string): string | undefined {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const key = new URLSearchParams(fragment).get("key");
  return key !== null && ADMIN_KEY_PATTERN.test(key) ? key : undefined;
}
