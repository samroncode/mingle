/** The codes a `join_result` can carry in its `error` field. */
const joinResultErrorCodes = [
  "not_found",
  "ended",
  "name_taken",
  "invalid_name",
  "rate_limited",
  "removed",
] as const;

/** Error codes the data layer returns; the UI maps each to an i18n key. */
export type JoinErrorCode = (typeof joinResultErrorCodes)[number] | "unknown";

export type RenameErrorCode =
  "not_found" | "name_taken" | "invalid_name" | "unknown";

/** Why a quiz answer wasn't saved: the question closed, or something else. */
export type AnswerErrorCode = "question_closed" | "unknown";

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

/** Maps the `error` field of a `join_result` to a typed code. */
export function toJoinErrorCode(code: string | null): JoinErrorCode {
  return joinResultErrorCodes.find((known) => known === code) ?? "unknown";
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

/**
 * Maps a Postgres error from answering a quiz question to a typed code.
 * Row Level Security refuses with 42501 once the question isn't open.
 */
export function toAnswerErrorCode(error: { code?: string }): AnswerErrorCode {
  return error.code === "42501" ? "question_closed" : "unknown";
}
