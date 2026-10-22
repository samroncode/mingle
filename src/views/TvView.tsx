import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { NicheTheme } from "@/components/NicheTheme";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { useTvJoin } from "@/hooks/useTvJoin";
import { useWakeLock } from "@/hooks/useWakeLock";
import { tvErrorKey } from "@/lib/tv-error";
import { PartyScreen } from "@/partyscreen/PartyScreen";

function Message({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <p role={alert ? "alert" : undefined} className="text-4xl">
      {text}
    </p>
  );
}

function ThankYou() {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-[80svh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-7xl font-semibold">{t("tv.ended.title")}</h1>
      <p className="text-4xl">{t("tv.ended.text")}</p>
    </section>
  );
}

/** Follows a joined event and shows the party screen, or the thank-you. */
function TvEvent({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  useEventLanguage(state.event?.language);

  if (!state.event) {
    return state.status === "error" ? (
      <Message alert text={t(tvErrorKey(state.error ?? "unknown"))} />
    ) : (
      <Message text={t("tv.joining")} />
    );
  }

  // An activity that is running also shows the party screen until activities
  // exist; each activity's spec hands the left side to its own TV component.
  const screen =
    state.event.status === "ended" ? (
      <ThankYou />
    ) : (
      <PartyScreen event={state.event} members={state.members} />
    );
  return <NicheTheme niche={state.event.niche}>{screen}</NicheTheme>;
}

/** The shared big-screen view: joins the event as its TV. */
export function TvView() {
  const { t } = useTranslation();
  const { code } = useParams();
  const join = useTvJoin(code);
  useWakeLock();

  // A TV that opens an ended event first gets `ended` from the join.
  if (join.status === "error" && join.error === "ended") return <ThankYou />;
  if (join.status === "error") {
    return <Message alert text={t(tvErrorKey(join.error))} />;
  }
  if (join.status === "joining") return <Message text={t("tv.joining")} />;
  return <TvEvent eventId={join.eventId} />;
}
