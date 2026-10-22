import type { SnapshotErrorCode } from "@/api/errors";
import type { MyMembership } from "@/api/events";

/** What the guest page needs to know about the live event. */
export type GuestSnapshot = {
  status: "loading" | "ready" | "error";
  eventStatus: string | null;
  error: SnapshotErrorCode | null;
};

export type GuestPageState =
  "loading" | "join" | "in" | "note" | "ended" | "not_found" | "error";

interface GuestPageInput {
  lookup: "loading" | "failed" | MyMembership;
  /** The live event; only followed once the caller is a guest. */
  snapshot?: GuestSnapshot;
  /** A join answer that ends the page's flow: only these two do. */
  joinOutcome?: "ended" | "not_found";
}

/** The state of a guest who is in, from the live event they follow. */
export function pickSnapshotState(snapshot: GuestSnapshot): GuestPageState {
  if (snapshot.status === "loading") return "loading";
  if (snapshot.eventStatus === "ended") return "ended";
  // A failed refetch keeps the last event on screen.
  if (snapshot.eventStatus !== null) return "in";
  return snapshot.error === "not_found" ? "not_found" : "error";
}

/** Chooses which state the guest page shows. */
export function pickGuestPageState({
  lookup,
  snapshot,
  joinOutcome,
}: GuestPageInput): GuestPageState {
  if (joinOutcome) return joinOutcome;
  if (lookup === "loading") return "loading";
  if (lookup === "failed") return "error";
  if (!lookup.isMember) return "join";
  if (lookup.role !== "guest") return "note";
  // Without a snapshot the guest is in; their page follows the event itself.
  return snapshot ? pickSnapshotState(snapshot) : "in";
}
