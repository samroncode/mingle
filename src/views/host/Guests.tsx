import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { renameGuest } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import { sortedGuests, type ListedGuest } from "@/lib/host/guest-list";
import { RemoveGuest } from "./RemoveGuest";

interface GuestsProps {
  code: string;
  hostKey: string;
  members: MemberRow[];
  language: string;
  /** Renaming and removing stop when the evening has ended. */
  ended: boolean;
}

function RenameForm({
  guest,
  code,
  hostKey,
  onDone,
}: {
  guest: ListedGuest;
  code: string;
  hostKey: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(guest.name);
  const { busy, error, run } = useHostAction();

  async function save() {
    const result = await run(() =>
      renameGuest({ code, key: hostKey, userId: guest.userId, name }),
    );
    if (result.ok) onDone();
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Input
        aria-label={t("hostPanel.guestList.nameLabel", { name: guest.name })}
        aria-invalid={!!error}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
      />
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t("hostPanel.guestList.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onDone}
        >
          {t("hostPanel.guestList.cancel")}
        </Button>
      </div>
    </form>
  );
}

function GuestRow({
  guest,
  code,
  hostKey,
  ended,
}: {
  guest: ListedGuest;
  code: string;
  hostKey: string;
  ended: boolean;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  if (removing) {
    return (
      <li>
        <RemoveGuest
          guest={guest}
          code={code}
          hostKey={hostKey}
          onDone={() => setRemoving(false)}
        />
      </li>
    );
  }
  if (renaming) {
    return (
      <li>
        <RenameForm
          guest={guest}
          code={code}
          hostKey={hostKey}
          onDone={() => setRenaming(false)}
        />
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="min-w-0 break-words text-base">{guest.name}</span>
      {!ended && (
        <span className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`${t("hostPanel.guestList.rename")} ${guest.name}`}
            onClick={() => setRenaming(true)}
          >
            {t("hostPanel.guestList.rename")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={`${t("hostPanel.guestList.remove")} ${guest.name}`}
            onClick={() => setRemoving(true)}
          >
            {t("hostPanel.guestList.remove")}
          </Button>
        </span>
      )}
    </li>
  );
}

/** The guests A to Z with the count, kept live by the members, Rename and Remove. */
export function Guests({
  code,
  hostKey,
  members,
  language,
  ended,
}: GuestsProps) {
  const { t } = useTranslation();
  const guests = sortedGuests(members, language);
  return (
    <Card data-testid="host-guests">
      <h2 className="font-display text-xl font-bold">
        {t("hostPanel.guestsTitle")} ({guests.length})
      </h2>
      {guests.length === 0 ? (
        <p className="text-ink-muted">{t("hostPanel.guestList.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {guests.map((guest) => (
            <GuestRow
              key={guest.userId}
              guest={guest}
              code={code}
              hostKey={hostKey}
              ended={ended}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
