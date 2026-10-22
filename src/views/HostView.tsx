import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { EventLinks } from "@/components/EventLinks";
import { Button } from "@/components/ui/button";
import { useClaimHost } from "@/hooks/useClaimHost";
import { useHostEventId } from "@/hooks/useHostEventId";
import { hostDoorErrorKey, readHostLink } from "@/lib/host-door";
import { ModuleSections } from "./host/ModuleSections";

/** Shown when the host link is bad or the claim was refused. */
function BadLink() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("hostDoor.badLink")}</h1>
      <p className="text-muted-foreground">{t("hostDoor.badLinkHint")}</p>
      <Button asChild variant="link" className="px-0">
        <Link to="/">{t("hostDoor.home")}</Link>
      </Button>
    </>
  );
}

/** The control panel's door: claims the event from the host link. */
export function HostView() {
  const { t } = useTranslation();
  const params = useParams();
  const { hash } = useLocation();
  const link = readHostLink(params.code, hash);
  const { state, retry } = useClaimHost(link);
  const eventId = useHostEventId(link?.code, state.status === "ready");

  if (state.status === "error") {
    const message = hostDoorErrorKey(state.error);
    if (message === "hostDoor.badLink") return <BadLink />;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("views.host.title")}</h1>
        <p role="alert" className="text-destructive">
          {t(message)}
        </p>
        <Button onClick={retry}>{t("hostDoor.retry")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("views.host.title")}</h1>
      {state.status === "loading" || !link ? (
        <p className="text-muted-foreground">{t("hostDoor.opening")}</p>
      ) : (
        <EventLinks code={link.code} hostKey={link.key} hideHostLink />
      )}
      {eventId && <ModuleSections eventId={eventId} />}
    </div>
  );
}
