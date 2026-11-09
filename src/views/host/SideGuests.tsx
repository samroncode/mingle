import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { Button } from "@/components/ui/button";
import { sortedGuests, type ListedGuest } from "@/lib/host/guest-list";
import { namedGuests } from "@/partyscreen/guests";
import { RemoveGuest } from "./RemoveGuest";
import { RenameForm } from "./Guests";

interface SideGuestsProps {
  code: string;
  hostKey: string;
  members: MemberRow[];
  language: string;
  /** Renaming and removing stop when the evening has ended. */
  ended: boolean;
}

type Tool = "menu" | "rename" | "remove";

/** The tools for one tapped guest, opened in place under the names. */
function GuestTools({
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
  const [tool, setTool] = useState<Tool>("menu");
  if (tool === "rename") {
    return (
      <RenameForm guest={guest} code={code} hostKey={hostKey} onDone={onDone} />
    );
  }
  if (tool === "remove") {
    return (
      <RemoveGuest
        guest={guest}
        code={code}
        hostKey={hostKey}
        onDone={onDone}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 break-words font-bold">{guest.name}</span>
      <Button size="sm" variant="outline" onClick={() => setTool("rename")}>
        {t("hostPanel.guestList.rename")}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setTool("remove")}>
        {t("hostPanel.guestList.remove")}
      </Button>
      <Button size="sm" variant="outline" onClick={onDone}>
        {t("hostPanel.guestList.cancel")}
      </Button>
    </div>
  );
}

/**
 * The guests in a compact wrap, with the count and who joined last. Tapping a
 * name opens rename and remove right there.
 */
export function SideGuests({
  code,
  hostKey,
  members,
  language,
  ended,
}: SideGuestsProps) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string>();
  const guests = sortedGuests(members, language);
  const latest = namedGuests(members).at(-1)?.display_name;
  const open = guests.find((guest) => guest.userId === openId);
  return (
    <section
      data-testid="side-guests"
      aria-label={t("hostPanel.guestsTitle")}
      className="space-y-2"
    >
      <h2 className="flex items-baseline justify-between font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
        {t("hostPanel.guestsTitle")}
        <span data-testid="side-guest-count">{guests.length}</span>
      </h2>
      {guests.length === 0 ? (
        <p className="text-ink-muted">{t("hostPanel.guestList.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-1 gap-y-1">
          {guests.map((guest) => (
            <li key={guest.userId}>
              <button
                type="button"
                disabled={ended}
                aria-expanded={openId === guest.userId}
                className="rounded-md px-2 py-1 text-base enabled:hover:bg-surface-sunken enabled:focus-visible:bg-surface-sunken"
                onClick={() =>
                  setOpenId(openId === guest.userId ? undefined : guest.userId)
                }
              >
                {guest.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {latest && (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.side.latest", { name: latest })}
        </p>
      )}
      {open && !ended && (
        <GuestTools
          key={open.userId}
          guest={open}
          code={code}
          hostKey={hostKey}
          onDone={() => setOpenId(undefined)}
        />
      )}
    </section>
  );
}
