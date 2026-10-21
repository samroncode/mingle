import type { HostActionError } from "@/api/host-actions";

/** i18n key for the message shown when creating an event fails. */
export function createErrorKey(error: HostActionError) {
  switch (error) {
    case "network_error":
    case "rate_limited":
    case "invalid_request":
      return `errors.create.${error}` as const;
    default:
      return "errors.create.internal_error" as const;
  }
}
