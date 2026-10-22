import type { HostActionError } from "@/api/host-actions";
import { readAdminKey } from "./admin-key";
import { EVENT_CODE_PATTERN } from "../formats";

export interface HostLinkParts {
  code: string;
  key: string;
}

/**
 * Reads the code from the route and the admin key from the fragment of a host
 * link. Returns nothing when either is missing or malformed, so the view can
 * say the link doesn't work without asking the server.
 */
export function readHostLink(
  code: string | undefined,
  hash: string,
): HostLinkParts | undefined {
  if (code === undefined || !EVENT_CODE_PATTERN.test(code)) return undefined;
  const key = readAdminKey(hash);
  return key === undefined ? undefined : { code, key };
}

/** Why the control panel couldn't open: a bad link, or a claim that failed. */
export type HostDoorError = HostActionError | "bad_link" | "captcha_failed";

/**
 * i18n key for the message shown when the control panel can't open. A bad
 * link and a refused claim (wrong key, unknown or expired code) look the
 * same, so the message never tells which part was wrong.
 */
export function hostDoorErrorKey(error: HostDoorError) {
  switch (error) {
    case "bad_link":
    case "not_authorized":
    case "invalid_request":
      return "hostDoor.badLink" as const;
    case "rate_limited":
    case "network_error":
    case "captcha_failed":
      return `hostDoor.${error}` as const;
    default:
      return "hostDoor.internal_error" as const;
  }
}
