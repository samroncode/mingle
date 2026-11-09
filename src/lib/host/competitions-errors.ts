import type { HostActionError } from "@/api/host-actions";
import { hostPanelErrorKey } from "./host-panel";

/**
 * i18n key of the message for a failed competitions change. `too_many` means
 * five competitions here, not the notices' limit; the rest is the panel's.
 */
export function competitionErrorKey(error: HostActionError) {
  switch (error) {
    case "too_many":
      return "modules.competitions.host.errors.too_many" as const;
    case "not_found":
      return "modules.competitions.host.errors.not_found" as const;
    case "invalid_request":
      return "modules.competitions.host.errors.invalid_request" as const;
    default:
      return hostPanelErrorKey(error);
  }
}

/**
 * i18n key of the message for a failed fix of a match. `not_found` means the
 * match is gone already; `invalid_request` a score or winner the database
 * refused; the rest is the panel's.
 */
export function matchErrorKey(error: HostActionError) {
  switch (error) {
    case "not_found":
      return "modules.competitions.host.matches.errors.not_found" as const;
    case "invalid_request":
      return "modules.competitions.host.matches.errors.invalid_request" as const;
    default:
      return hostPanelErrorKey(error);
  }
}
