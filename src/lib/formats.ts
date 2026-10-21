// The formats of event codes and admin keys, shared by the app and the
// host-actions Edge Function. The function imports this file by relative path
// under Deno: no imports, and no browser or Node APIs.

/** Event code characters, without look-alikes (no 0/O, no 1/I/L), as in the database. */
export const EVENT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const EVENT_CODE_LENGTH = 6;

export const EVENT_CODE_PATTERN = new RegExp(
  `^[${EVENT_CODE_ALPHABET}]{${EVENT_CODE_LENGTH}}$`,
);

/** 32 random bytes, base64url-encoded without padding (43 characters). */
export const ADMIN_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
