import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { useTvJoin } from "@/hooks/useTvJoin";
import { useWakeLock } from "@/hooks/useWakeLock";
import { tvErrorKey } from "@/lib/tv/tv-error";
import { ThankYou, TvScreen } from "./TvScreen";

function Message({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <p role={alert ? "alert" : undefined} className="text-4xl">
      {text}
    </p>
  );
}

function TvNotFound() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Message alert text={t("tv.errors.not_found")} />
      <Button asChild variant="link" className="px-0 text-2xl">
        <Link to="/">{t("views.notFound.home")}</Link>
      </Button>
    </div>
  );
}

/** Follows a joined event and shows the party screen, or the thank-you. */
function TvEvent({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  useEventLanguage(state.event?.language);

  if (!state.event) {
    if (state.status === "error" && state.error === "not_found") {
      return <TvNotFound />;
    }
    return state.status === "error" ? (
      <Message alert text={t(tvErrorKey(state.error ?? "unknown"))} />
    ) : (
      <Message text={t("tv.joining")} />
    );
  }

  return <TvScreen event={state.event} members={state.members} />;
}

/** The shared big-screen view: joins the event as its TV. */
export function TvView() {
  const { t } = useTranslation();
  const { code } = useParams();
  const { state: join, retry } = useTvJoin(code);
  useWakeLock();

  // A TV that opens an ended event first gets `ended` from the join.
  if (join.status === "error" && join.error === "ended") return <ThankYou />;
  if (join.status === "error" && join.error === "not_found") {
    return <TvNotFound />;
  }
  if (join.status === "error") {
    return (
      <div className="space-y-6">
        <Message alert text={t(tvErrorKey(join.error))} />
        {join.error === "captcha_failed" && (
          <Button size="lg" onClick={retry}>
            {t("captcha.retry")}
          </Button>
        )}
      </div>
    );
  }
  if (join.status === "joining") return <Message text={t("tv.joining")} />;
  return <TvEvent eventId={join.eventId} />;
}
