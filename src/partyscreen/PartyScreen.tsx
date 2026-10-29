import type { ReactNode } from "react";
import type { EventRow, MemberRow } from "@/api/events";
import { FunZone } from "@/components/FunZone";
import { countGuests } from "./guests";
import { GuestWelcome } from "./GuestWelcome";
import { JoinPanel } from "./JoinPanel";
import { PartRotation } from "./PartRotation";
import { readParty } from "@/lib/party";

interface PartyScreenProps {
  event: EventRow;
  members: MemberRow[];
  /** Replaces the left side; the rotation and activities plug in here. */
  left?: ReactNode;
}

/** The TV's idle state: a left slot for content and the fixed join panel. */
export function PartyScreen({ event, members, left }: PartyScreenProps) {
  const party = readParty(event.party);
  return (
    <FunZone level="playful">
      <div className="tv-backdrop -m-(--space-6) grid min-h-svh grid-cols-[1fr_30rem] gap-(--space-7) p-(--space-6)">
        <div data-testid="party-left" className="relative">
          {left ?? <PartRotation party={party} members={members} />}
          <GuestWelcome members={members} />
        </div>
        <JoinPanel code={event.code} guestCount={countGuests(members)} />
      </div>
    </FunZone>
  );
}
