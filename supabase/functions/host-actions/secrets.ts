// Event codes and admin keys. Never log a key: only its hash is stored.
import {
  EVENT_CODE_ALPHABET,
  EVENT_CODE_LENGTH,
} from "../../../src/lib/formats.ts";

// The largest multiple of the alphabet size below 256. Bytes at or above it
// are skipped, so every character is equally likely.
const CODE_BYTE_LIMIT = 256 - (256 % EVENT_CODE_ALPHABET.length);

/** A random event code from the alphabet without look-alikes. */
export function generateEventCode(): string {
  let code = "";
  while (code.length < EVENT_CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < CODE_BYTE_LIMIT && code.length < EVENT_CODE_LENGTH) {
        code += EVENT_CODE_ALPHABET[byte % EVENT_CODE_ALPHABET.length];
      }
    }
  }
  return code;
}

/** 32 random bytes, base64url-encoded without padding (43 characters). */
export function generateAdminKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 of the key's text as it appears in the host link, lowercase hex. */
export async function hashAdminKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
