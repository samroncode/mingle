import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { useGuestLookup } from "@/hooks/useGuestLookup";
import { pickGuestPageState } from "@/lib/guest/guest-page";
import { GuestIn } from "./GuestIn";
import { GuestMessage } from "./GuestMessage";
import { NameForm } from "./NameForm";

/** Where a guest joins an event and follows it from their phone. */
export function GuestView() {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const { lookup, userId, joinOutcome, join, checkRemoved, retry } =
    useGuestLookup(code);
  const page = pickGuestPageState({ lookup, joinOutcome });

  if (page === "in" && typeof lookup === "object" && lookup.isMember) {
    return (
      <GuestIn
        eventId={lookup.eventId}
        userId={userId}
        onAccessLost={checkRemoved}
      />
    );
  }
  if (page === "join") {
    return (
      <Card className="gap-5 bg-champagne p-6 text-on-bright">
        <Sticker color="coral" lean="left" className="self-start">
          {t("guest.joinSticker")}
        </Sticker>
        <h1 className="font-display text-5xl leading-none font-extrabold">
          {t("views.guest.title")}
        </h1>
        <NameForm
          label={t("guest.nameLabel")}
          submitLabel={t("guest.join")}
          onSubmit={join}
        />
      </Card>
    );
  }
  if (page === "loading" || page === "in") {
    return <p className="text-lg text-ink-muted">{t("guest.loading")}</p>;
  }
  if (page === "captcha_failed") {
    return <GuestMessage kind="captcha_failed" onRetry={retry} />;
  }
  return <GuestMessage kind={page} />;
}
