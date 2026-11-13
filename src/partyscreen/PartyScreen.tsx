import type { ReactNode } from "react";
import type { EventRow, MemberRow } from "@/api/events";
import { FunZone } from "@/components/FunZone";
import { Logo } from "@/components/Logo";
import { countGuests } from "./guests";
import { GuestStrip } from "./GuestStrip";
import { GuestWelcome } from "./GuestWelcome";
import { JoinPanel } from "./JoinPanel";
import { PartRotation } from "./PartRotation";
import { TvSurface } from "./TvSurface";
import { WinnerCongrats } from "./WinnerCongrats";
import { readParty } from "@/lib/party";

interface PartyScreenProps {
  event: EventRow;
  members: MemberRow[];
  /** Replaces the left side; the rotation and activities plug in here. */
  left?: ReactNode;
}

/**
 * The TV: the logo on top, the left side (welcome and one rotating
 * part, or a running activity), the join card, and who is here along the bottom.
 */
export function PartyScreen({ event, members, left }: PartyScreenProps) {
  const party = readParty(event.party);
  return (
    <FunZone level="playful">
      <TvSurface>
        <header className="border-b border-champagne pb-(--space-3)">
          <Logo className="text-5xl" />
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_30rem] gap-(--space-7)">
          <div data-testid="party-left" className="relative min-h-0">
            {left ?? (
              <PartRotation event={event} party={party} members={members} />
            )}
            <GuestWelcome members={members} />
            <WinnerCongrats party={party} />
          </div>
          <JoinPanel code={event.code} guestCount={countGuests(members)} />
        </div>
        <GuestStrip members={members} />
      </TvSurface>
    </FunZone>
  );
}
