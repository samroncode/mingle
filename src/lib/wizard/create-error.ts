import type { HostActionError } from "@/api/host-actions";

/** Why creating an event failed: a host action error, or the CAPTCHA. */
export type CreateError = HostActionError | "captcha_failed";

/** i18n key for the message shown when creating an event fails. */
export function createErrorKey(error: CreateError) {
  switch (error) {
    case "captcha_failed":
      return "captcha.failed" as const;
    case "network_error":
    case "rate_limited":
    case "invalid_request":
      return `errors.create.${error}` as const;
    default:
      return "errors.create.internal_error" as const;
  }
}
