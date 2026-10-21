/** Error codes the data layer returns; the UI maps each to an i18n key. */
export type JoinErrorCode =
  | "not_found"
  | "ended"
  | "name_taken"
  | "invalid_name"
  | "rate_limited"
  | "unknown";

export type RenameErrorCode =
  "not_found" | "name_taken" | "invalid_name" | "unknown";

export type SnapshotErrorCode = "not_found" | "unknown";

/** A result the UI can branch on without try/catch. */
export type Result<T, E extends string> =
  { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E extends string>(error: E): Result<never, E> {
  return { ok: false, error };
}

const joinCodes: readonly string[] = [
  "not_found",
  "ended",
  "name_taken",
  "invalid_name",
  "rate_limited",
];

/** Maps the `error` field of a `join_result` to a typed code. */
export function toJoinErrorCode(code: string | null): JoinErrorCode {
  return code !== null && joinCodes.includes(code)
    ? (code as JoinErrorCode)
    : "unknown";
}

/** Maps a Postgres error from renaming a guest to a typed code. */
export function toRenameErrorCode(error: {
  code?: string;
  message: string;
}): RenameErrorCode {
  if (
    error.code === "23505" &&
    error.message.includes("members_guest_name_key")
  )
    return "name_taken";
  if (error.code === "23514") return "invalid_name";
  return "unknown";
}
