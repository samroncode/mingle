import type { HostActionError } from "@/api/host-actions";
import { hostPanelErrorKey } from "./host-panel";

/**
 * i18n key of the message for a failed change to the Lucky wheel. The limit
 * is 24 entries here, not the notices' limit; the rest is the panel's.
 */
export function wheelErrorKey(error: HostActionError) {
  switch (error) {
    case "too_many":
      return "modules.wheel.host.errors.too_many" as const;
    case "already_added":
      return "modules.wheel.host.errors.already_added" as const;
    case "invalid_name":
      return "modules.wheel.host.errors.invalid_name" as const;
    case "not_found":
      return "modules.wheel.host.errors.not_found" as const;
    default:
      return hostPanelErrorKey(error);
  }
}
