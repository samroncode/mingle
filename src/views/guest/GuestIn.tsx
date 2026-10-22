import { useState } from "react";
import { useTranslation } from "react-i18next";
import { renameGuest } from "@/api/events";
import { NicheTheme } from "@/components/NicheTheme";
import { Button } from "@/components/ui/button";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { pickSnapshotState } from "@/lib/guest-page";
import { readParty } from "@/lib/party";
import { pickScreen } from "@/modules/screen";
import { GuestMessage } from "./GuestMessage";
import { NameForm } from "./NameForm";
import { PartyInfo } from "./PartyInfo";

interface GuestInProps {
  eventId: string;
  userId: string;
}

/** The page of a guest who has joined: follows the event live. */
export function GuestIn({ eventId, userId }: GuestInProps) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  const [renaming, setRenaming] = useState(false);
  useEventLanguage(state.event?.language);

  const page = pickSnapshotState({
    status: state.status,
    eventStatus: state.event?.status ?? null,
    error: state.error,
  });
  if (page === "ended" || page === "not_found" || page === "error") {
    return <GuestMessage kind={page} />;
  }
  if (page !== "in" || !state.event) {
    return <p className="text-muted-foreground">{t("guest.loading")}</p>;
  }

  const choice = pickScreen(state.event.current_module);
  const name = state.members.find((m) => m.user_id === userId)?.display_name;
  const content = (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {t("guest.in", { name: name ?? "" })}
      </h1>
      {renaming ? (
        <NameForm
          label={t("guest.renameLabel")}
          submitLabel={t("guest.renameSave")}
          initialName={name ?? ""}
          onSubmit={async (next) => {
            const result = await renameGuest(eventId, next);
            if (result.ok) {
              setRenaming(false);
              return undefined;
            }
            return result.error;
          }}
        />
      ) : (
        <Button variant="outline" onClick={() => setRenaming(true)}>
          {t("guest.rename")}
        </Button>
      )}
      {choice.kind === "module" ? (
        <choice.definition.Guest
          event={state.event}
          members={state.members}
          userId={userId}
        />
      ) : (
        <PartyInfo party={readParty(state.event.party)} />
      )}
    </div>
  );
  return <NicheTheme niche={state.event.niche}>{content}</NicheTheme>;
}
