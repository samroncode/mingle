import type { MemberRow } from "@/api/events";
import type { Party } from "@/lib/schemas/party";
import {
  GuestsPart,
  MenuPart,
  MusicPart,
  SchedulePart,
  WifiPart,
  WinnersPart,
} from "./PartPanels";
import { partsOf, type Part } from "./parts";
import { useRotation } from "./rotation";
import { WelcomePart } from "./WelcomePart";

function PartView({ part }: { part: Part }) {
  switch (part.kind) {
    case "welcome":
      return <WelcomePart welcome={part.text} />;
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
    case "guests":
      return <GuestsPart {...part} />;
  }
}

/** The left side of the party screen: the filled-in parts, one at a time. */
export function PartRotation({
  party,
  members,
}: {
  party: Party;
  members: MemberRow[];
}) {
  const parts = partsOf(party, members);
  const shown = useRotation(parts.map((part) => part.kind));
  const part = parts.find((candidate) => candidate.kind === shown);
  // With nothing filled in, fall back to the app name like the welcome part.
  return part ? (
    <PartView key={part.kind} part={part} />
  ) : (
    <WelcomePart welcome={undefined} />
  );
}
