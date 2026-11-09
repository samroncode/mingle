import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

/** A competition as a member of the event reads it. */
export interface CompetitionView {
  id: string;
  /** 0-based place in the event's list. */
  position: number;
  /** Host-written, shown as typed in every language. */
  name: string;
}

/** The event's competitions in order. Any member of the event can read them. */
export async function listCompetitions(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<CompetitionView[], "unknown">> {
  const { data, error } = await client
    .from("competitions")
    .select("id, position, name")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(data);
}

/** Changes arrive in bursts (a reorder moves several rows); one refetch is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a competition of the event
 * changes. Changes are only a signal to refetch, so RLS applies to every
 * read. Returns a function that stops it.
 */
export function subscribeToCompetitionChanges(
  eventId: string,
  onChange: () => void,
  client: AppClient = getSupabase(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const signal = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, CHANGE_DELAY_MS);
  };
  // A random suffix: two views of one event must not share a channel.
  const channel = client
    .channel(`competitions:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "competitions",
        filter: `event_id=eq.${eventId}`,
      },
      signal,
    )
    .subscribe();
  return () => {
    clearTimeout(timer);
    void client.removeChannel(channel);
  };
}

/** Why a reported match was refused. Anything unexpected is `unknown`. */
export type ReportMatchErrorCode =
  | "not_found"
  | "ended"
  | "disabled"
  | "same_player"
  | "not_a_participant"
  | "unknown_competition"
  | "unknown_player"
  | "invalid_score"
  | "score_mismatch"
  | "rate_limited"
  | "unknown";

const reportMatchErrorCodes: readonly ReportMatchErrorCode[] = [
  "not_found",
  "ended",
  "disabled",
  "same_player",
  "not_a_participant",
  "unknown_competition",
  "unknown_player",
  "invalid_score",
  "score_mismatch",
  "rate_limited",
];

/** Maps the answer of `report_match` to a typed code. */
export function toReportMatchErrorCode(answer: string): ReportMatchErrorCode {
  return reportMatchErrorCodes.find((code) => code === answer) ?? "unknown";
}

/** A match a guest reports: who won, who lost and optionally the score. */
export interface MatchReport {
  eventId: string;
  competitionId: string;
  winnerId: string;
  loserId: string;
  /** Both scores, or neither. */
  score?: { winner: number; loser: number };
}

/** Reports a match as the signed-in guest, who must be the winner or the loser. */
export async function reportMatch(
  report: MatchReport,
  client: AppClient = getSupabase(),
): Promise<Result<null, ReportMatchErrorCode>> {
  const { data, error } = await client.rpc("report_match", {
    target_event_id: report.eventId,
    target_competition_id: report.competitionId,
    winner: report.winnerId,
    loser: report.loserId,
    winner_score: report.score?.winner,
    loser_score: report.score?.loser,
  });
  if (error || typeof data !== "string") return fail("unknown");
  return data === "reported" ? ok(null) : fail(toReportMatchErrorCode(data));
}

/** A reported match as a member reads it. */
export interface MatchView {
  id: string;
  competitionId: string;
  winnerId: string;
  loserId: string;
  winnerScore: number | null;
  loserScore: number | null;
  createdAt: string;
}

/** The matches `userId` played in the event, newest first. */
export async function listMyMatches(
  eventId: string,
  userId: string,
  client: AppClient = getSupabase(),
): Promise<Result<MatchView[], "unknown">> {
  const { data, error } = await client
    .from("competition_matches")
    .select(
      "id, competition_id, winner_id, loser_id, winner_score, loser_score, created_at",
    )
    .eq("event_id", eventId)
    .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      competitionId: row.competition_id,
      winnerId: row.winner_id,
      loserId: row.loser_id,
      winnerScore: row.winner_score,
      loserScore: row.loser_score,
      createdAt: row.created_at,
    })),
  );
}

/** Calls `onChange` (once per burst) when a match of the event changes. */
export function subscribeToMatchChanges(
  eventId: string,
  onChange: () => void,
  client: AppClient = getSupabase(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const signal = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, CHANGE_DELAY_MS);
  };
  const channel = client
    .channel(`matches:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "competition_matches",
        filter: `event_id=eq.${eventId}`,
      },
      signal,
    )
    .subscribe();
  return () => {
    clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
