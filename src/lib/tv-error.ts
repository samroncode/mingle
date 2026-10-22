import type { JoinErrorCode, SnapshotErrorCode } from "@/api/errors";

/** Why the TV has nothing to show: the join or a later read failed. */
export type TvError = JoinErrorCode | SnapshotErrorCode;

/** The i18n key for a TV error; an ended event is not an error on the TV. */
export function tvErrorKey(error: TvError) {
  switch (error) {
    case "not_found":
      return "tv.errors.not_found" as const;
    case "rate_limited":
      return "tv.errors.rate_limited" as const;
    default:
      return "tv.errors.unknown" as const;
  }
}
