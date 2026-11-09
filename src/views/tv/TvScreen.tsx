import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { NicheTheme } from "@/components/NicheTheme";
import { pickScreen } from "@/modules/screen";
import { PartyScreen } from "@/partyscreen/PartyScreen";

/** The thank-you the TV shows once the evening has ended. */
export function ThankYou() {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-[80svh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-7xl font-semibold">{t("tv.ended.title")}</h1>
      <p className="text-4xl">{t("tv.ended.text")}</p>
    </section>
  );
}

interface TvScreenProps {
  event: EventRow;
  members: MemberRow[];
  /**
   * False for a copy shown inside another page (the host's TV mirror): the
   * bright-room theme then stays on the copy and does not reach the page root.
   */
  themeRoot?: boolean;
}

/**
 * What the TV shows for an event snapshot: the thank-you after the end, else
 * the party screen with the running activity's view on the left. The real TV
 * and the host's mirror both render this, so they show the same screen.
 */
export function TvScreen({ event, members, themeRoot = true }: TvScreenProps) {
  // A running activity with views takes the left side; the join panel stays.
  const choice = pickScreen(event.current_module);
  const left =
    choice.kind === "module" ? (
      <choice.definition.Tv event={event} members={members} />
    ) : undefined;
  const screen =
    event.status === "ended" ? (
      <ThankYou />
    ) : (
      <PartyScreen event={event} members={members} left={left} />
    );
  return (
    <NicheTheme
      niche={event.niche}
      bright={event.bright_room}
      themeRoot={themeRoot}
    >
      {screen}
    </NicheTheme>
  );
}
