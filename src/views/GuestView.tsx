import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { useGuestLookup } from "@/hooks/useGuestLookup";
import { pickGuestPageState } from "@/lib/guest-page";
import { GuestIn } from "./guest/GuestIn";
import { GuestMessage } from "./guest/GuestMessage";
import { NameForm } from "./guest/NameForm";

/** Where a guest joins an event and follows it from their phone. */
export function GuestView() {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const { lookup, userId, joinOutcome, join } = useGuestLookup(code);
  const page = pickGuestPageState({ lookup, joinOutcome });

  if (page === "in" && typeof lookup === "object" && lookup.isMember) {
    return <GuestIn eventId={lookup.eventId} userId={userId} />;
  }
  if (page === "join") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("views.guest.title")}</h1>
        <NameForm
          label={t("guest.nameLabel")}
          submitLabel={t("guest.join")}
          onSubmit={join}
        />
      </div>
    );
  }
  if (page === "loading" || page === "in") {
    return <p className="text-muted-foreground">{t("guest.loading")}</p>;
  }
  return <GuestMessage kind={page} />;
}
