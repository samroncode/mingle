import type { MemberRow } from "@/api/events";
import type { Party } from "@/lib/schemas/party";
import {
  MenuPart,
  MusicPart,
  SchedulePart,
  WifiPart,
  WinnersPart,
} from "./PartPanels";
import { partsOf, type Part } from "./parts";
import { useRotation } from "./rotation";
import { WelcomePart } from "./WelcomePart";

/** The parts that take turns under the welcome; welcome and guests stay put. */
type SlotPart = Exclude<Part, { kind: "welcome" } | { kind: "guests" }>;

function isSlotPart(part: Part): part is SlotPart {
  return part.kind !== "welcome" && part.kind !== "guests";
}

function PartView({ part }: { part: SlotPart }) {
  switch (part.kind) {
    case "menu":
      return <MenuPart {...part} />;
    case "schedule":
      return <SchedulePart {...part} />;
    case "winners":
      return <WinnersPart {...part} />;
    case "wifi":
      return <WifiPart {...part} />;
    case "music":
      return <MusicPart {...part} />;
  }
}

/**
 * The left side of the party screen: the welcome always, and under it the
 * filled-in parts (menu, schedule, winners, wifi, music), one at a time.
 */
export function PartRotation({
  party,
  members,
}: {
  party: Party;
  members: MemberRow[];
}) {
  const parts = partsOf(party, members).filter(isSlotPart);
  const shown = useRotation(parts.map((part) => part.kind));
  const part = parts.find((candidate) => candidate.kind === shown);
  return (
    <div className="flex h-full flex-col gap-(--space-6)">
      <WelcomePart welcome={party.welcome} />
      {part && (
        <div className="min-h-0 flex-1 overflow-hidden">
          <PartView key={part.kind} part={part} />
        </div>
      )}
    </div>
  );
}
