import { useEffect } from "react";
import type { EventRow, MemberRow } from "@/api/events";
import type { Party } from "@/lib/schemas/party";
import {
  MenuPart,
  MusicPart,
  SchedulePart,
  StandingsPart,
  WifiPart,
  WinnersPart,
} from "./PartPanels";
import { useStandings } from "@/modules/competitions/useStandings";
import { partKey, partsOf, type Part } from "./parts";
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
    case "standings":
      return <StandingsPart {...part} />;
    case "wifi":
      return <WifiPart {...part} />;
    case "music":
      return <MusicPart {...part} />;
  }
}

/**
 * The left side of the party screen: the welcome always, and under it the
 * filled-in parts (menu, schedule, winners, tables, wifi, music), one at a time.
 */
export function PartRotation({
  event,
  party,
  members,
}: {
  event: EventRow;
  party: Party;
  members: MemberRow[];
}) {
  const { tables } = useStandings(event, members);
  const parts = partsOf(party, members, tables).filter(isSlotPart);
  const { shown, step } = useRotation(parts.map(partKey));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === " ") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
  const part = parts.find((candidate) => partKey(candidate) === shown);
  return (
    <div className="flex h-full flex-col gap-(--space-6)">
      <WelcomePart welcome={party.welcome} />
      {part && (
        <div
          data-testid="part-click"
          className="min-h-0 flex-1 cursor-pointer overflow-hidden"
          onClick={() => step(1)}
        >
          <PartView key={partKey(part)} part={part} />
        </div>
      )}
    </div>
  );
}
