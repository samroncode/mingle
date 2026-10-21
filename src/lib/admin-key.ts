import { ADMIN_KEY_PATTERN } from "./formats";

/** Reads the admin key from a URL fragment such as `#key=…`. */
export function readAdminKey(hash: string): string | undefined {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const key = new URLSearchParams(fragment).get("key");
  return key !== null && ADMIN_KEY_PATTERN.test(key) ? key : undefined;
}
