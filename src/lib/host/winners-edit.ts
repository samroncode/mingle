import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { UpdatePartyContentResponse } from "@/lib/schemas/host-actions";
import { partyLimits, type Party } from "@/lib/schemas/party";

/** A winner as the host types it: what they won and who won. */
export interface WinnerInput {
  title: string;
  name: string;
}

/** What the host can do on the Winners section; each one saves at once. */
export type WinnersChange =
  | { kind: "add"; winner: WinnerInput }
  | { kind: "edit"; index: number; winner: WinnerInput }
  | { kind: "delete"; index: number }
  | { kind: "hidden"; hidden: boolean };

/** Why a change was refused before it left the phone. */
export type WinnerProblem = "title" | "name" | "full";

export type WinnersSaveResult =
  | { ok: true }
  | { ok: false; problems: WinnerProblem[] }
  | { ok: false; error: HostActionError };

type SendParty = (input: {
  code: string;
  key: string;
  party: Party;
}) => Promise<HostActionResult<UpdatePartyContentResponse>>;

const validText = (value: string) => {
  const length = value.trim().length;
  return length >= 1 && length <= partyLimits.winnerText;
};

/** The fields of `winner` that are empty or too long once trimmed. */
export function winnerProblems(winner: WinnerInput): WinnerProblem[] {
  const problems: WinnerProblem[] = [];
  if (!validText(winner.title)) problems.push("title");
  if (!validText(winner.name)) problems.push("name");
  return problems;
}

const clean = (winner: WinnerInput): WinnerInput => ({
  title: winner.title.trim(),
  name: winner.name.trim(),
});

/** The winners list after `change`; the list as it was for a hide or show. */
function nextWinners(winners: WinnerInput[], change: WinnersChange) {
  switch (change.kind) {
    case "add":
      return [...winners, clean(change.winner)];
    case "edit":
      return winners.map((w, i) =>
        i === change.index ? clean(change.winner) : w,
      );
    case "delete":
      return winners.filter((_, i) => i !== change.index);
    case "hidden":
      return winners;
  }
}

/** Problems that make `change` impossible, before anything is sent. */
function problemsOf(winners: WinnerInput[], change: WinnersChange) {
  if (change.kind === "add" || change.kind === "edit") {
    const problems = winnerProblems(change.winner);
    if (change.kind === "add" && winners.length >= partyLimits.winners) {
      problems.push("full");
    }
    return problems;
  }
  return [];
}

/**
 * `saved` with only the winners and the hidden flag replaced. The welcome
 * text, menu, schedule, wifi and music are carried over untouched, because
 * saving replaces the whole party object. An empty list or a shown slide
 * leaves its field out.
 */
export function withWinnersChange(saved: Party, change: WinnersChange): Party {
  const rest = { ...saved };
  delete rest.winners;
  delete rest.winnersHidden;
  const winners = nextWinners(saved.winners ?? [], change);
  const hidden =
    change.kind === "hidden" ? change.hidden : (saved.winnersHidden ?? false);
  return {
    ...rest,
    ...(winners.length > 0 && { winners }),
    ...(hidden && { winnersHidden: true }),
  };
}

/** Checks `change` and saves it. The Party screen editor owns the other fields. */
export async function saveWinners(
  change: WinnersChange,
  saved: Party,
  target: { code: string; key: string },
  send: SendParty,
): Promise<WinnersSaveResult> {
  const problems = problemsOf(saved.winners ?? [], change);
  if (problems.length > 0) return { ok: false, problems };
  const result = await send({
    ...target,
    party: withWinnersChange(saved, change),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
