import type { MemberRow } from "@/api/events";
import type { CompetitionTable } from "@/lib/competitions/standings";
import type { Party } from "@/lib/schemas/party";
import { guestNames } from "./guests";

export type Part =
  | { kind: "welcome"; text: string }
  | { kind: "menu"; lines: string[] }
  | { kind: "schedule"; items: NonNullable<Party["schedule"]> }
  | { kind: "winners"; winners: NonNullable<Party["winners"]> }
  | { kind: "wifi"; ssid: string; password: string }
  | { kind: "music"; url: string }
  | { kind: "standings"; table: CompetitionTable }
  | { kind: "guests"; names: string[] };

/** The key a part rotates by; each competition's table is its own part. */
export function partKey(part: Part): string {
  return part.kind === "standings"
    ? `standings:${part.table.competitionId}`
    : part.kind;
}

/** The parts to rotate through, in order, leaving out whatever is empty. */
export function partsOf(
  party: Party,
  members: MemberRow[],
  tables: CompetitionTable[] = [],
): Part[] {
  const names = guestNames(members);
  const parts: (Part | false)[] = [
    party.welcome !== undefined && { kind: "welcome", text: party.welcome },
    !!party.menu?.length && { kind: "menu", lines: party.menu },
    !!party.schedule?.length && { kind: "schedule", items: party.schedule },
    !!party.winners?.length &&
      !party.winnersHidden && { kind: "winners", winners: party.winners },
    ...tables.map((table) => ({ kind: "standings" as const, table })),
    party.wifi !== undefined && { kind: "wifi", ...party.wifi },
    party.musicUrl !== undefined && { kind: "music", url: party.musicUrl },
    names.length > 0 && { kind: "guests", names },
  ];
  return parts.filter((part): part is Part => part !== false);
}
