import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { renameGuest } from "@/api/events";
import { NicheTheme } from "@/components/NicheTheme";
import { Button } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { idsSignal } from "@/lib/guest/bill";
import { pickSnapshotState } from "@/lib/guest/guest-page";
import { readParty } from "@/lib/party";
import { pickScreen } from "@/modules/screen";
import { GuestBill } from "./GuestBill";
import { GuestMessage } from "./GuestMessage";
import { NameForm } from "./NameForm";
import { PartyInfo } from "./PartyInfo";

interface GuestInProps {
  eventId: string;
  userId: string;
  /** Where the receipt icon goes: next to the language switch. */
  billSlot?: HTMLElement | null;
  /** The event can no longer be read: the guest may have been removed. */
  onAccessLost: () => Promise<void>;
}

/** The page of a guest who has joined: follows the event live. */
export function GuestIn({
  eventId,
  userId,
  billSlot,
  onAccessLost,
}: GuestInProps) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  const [renaming, setRenaming] = useState(false);
  useEventLanguage(state.event?.language);

  const page = pickSnapshotState({
    status: state.status,
    eventStatus: state.event?.status ?? null,
    error: state.error,
  });
  const lost = page === "not_found";
  useEffect(() => {
    if (lost) void onAccessLost();
  }, [lost, onAccessLost]);
  if (page === "not_found" || page === "error") {
    return <GuestMessage kind={page} />;
  }
  if ((page !== "in" && page !== "ended") || !state.event) {
    return <p className="text-lg text-ink-muted">{t("guest.loading")}</p>;
  }

  // The bill is read again when the host changes it, and when a guest leaves.
  const billSignal =
    state.event.costs_version * 1_000_003 +
    idsSignal(state.members.map((member) => member.user_id));
  const name = state.members.find((m) => m.user_id === userId)?.display_name;
  const bill = (
    <GuestBill
      eventId={eventId}
      code={state.event.code}
      guestName={name ?? ""}
      signal={billSignal}
      slot={billSlot}
    />
  );
  // People pay the next day: the receipt icon stays after the evening ends.
  if (page === "ended") {
    return (
      <>
        {bill}
        <GuestMessage kind="ended" />
      </>
    );
  }
  const choice = pickScreen(state.event.current_module);
  const content = (
    <div className="space-y-5">
      {bill}
      <header className="space-y-3">
        <Sticker color="sage" lean="left">
          {t("guest.joinedSticker")}
        </Sticker>
        <h1 className="font-display text-5xl leading-none font-extrabold break-words">
          {t("guest.in", { name: name ?? "" })}
        </h1>
      </header>
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
        <Button variant="secondary" onClick={() => setRenaming(true)}>
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
  return (
    <NicheTheme niche={state.event.niche} bright={state.event.bright_room}>
      {content}
    </NicheTheme>
  );
}
