import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { updatePartyContent } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { useHostAction } from "@/hooks/useHostAction";
import { saveTvPin } from "@/lib/host/tv-pin";
import { readParty } from "@/lib/party";
import { useStandings } from "@/modules/competitions/useStandings";
import {
  isSlotPart,
  partKey,
  partsOf,
  type SlotPart,
} from "@/partyscreen/parts";
import { cn } from "cn";

interface TvScreenPickerProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-pill border-[length:var(--border-thin)] border-edge px-4 font-display font-bold",
        selected ? "bg-forest text-on-forest" : "bg-paper text-on-paper",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Run, while no activity is on the TV: pick which part of the party screen
 * the TV shows. A pick stays until the host chooses Auto, which lets the
 * parts take turns again.
 */
export function TvScreenPicker({
  event,
  members,
  hostKey,
}: TvScreenPickerProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction(undefined, "host");
  const { tables } = useStandings(event, members);
  const party = readParty(event.party);
  const parts = partsOf(party, members, tables).filter(isSlotPart);
  if (parts.length === 0) return null;
  const pinned = parts.find((part) => partKey(part) === party.tvPin);

  const label = (part: SlotPart) =>
    part.kind === "standings"
      ? part.table.name
      : t(`hostPanel.tvScreen.parts.${part.kind}`);
  const pick = (key: string | undefined) =>
    void run(
      () =>
        saveTvPin(
          key,
          party,
          { code: event.code, key: hostKey },
          updatePartyContent,
        ),
      "tv_pin",
    );

  return (
    <section
      data-testid="tv-screen-picker"
      aria-label={t("hostPanel.tvScreen.title")}
      className="space-y-3"
    >
      <h3 className="font-display text-lg font-bold">
        {t("hostPanel.tvScreen.title")}
      </h3>
      <div className="flex flex-wrap gap-2">
        <Chip
          testId="tv-pin-auto"
          selected={!pinned}
          disabled={busy}
          onClick={() => pick(undefined)}
        >
          {t("hostPanel.tvScreen.auto")}
        </Chip>
        {parts.map((part) => (
          <Chip
            key={partKey(part)}
            testId={`tv-pin-${partKey(part)}`}
            selected={pinned !== undefined && partKey(pinned) === partKey(part)}
            disabled={busy}
            onClick={() => pick(partKey(part))}
          >
            {label(part)}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        {pinned
          ? t("hostPanel.tvScreen.locked", { name: label(pinned) })
          : t("hostPanel.tvScreen.autoHelp")}
      </p>
      {error && <ErrorLine>{error}</ErrorLine>}
    </section>
  );
}
