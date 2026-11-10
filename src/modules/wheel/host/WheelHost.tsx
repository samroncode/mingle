import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { updateWheel } from "@/api/host-actions";
import type { WheelEntryView } from "@/api/wheel";
import { ErrorLine } from "@/components/ErrorLine";
import { useHostAction } from "@/hooks/useHostAction";
import { wheelErrorKey } from "@/lib/host/wheel-errors";
import type { WheelChange } from "@/lib/schemas/host-actions";
import { wheelLimits } from "@/lib/schemas/wheel";
import {
  customEntries,
  guestChoices,
  openSuggestions,
  selectAllSteps,
  selectNoneSteps,
  takenOff,
  wheelIsFull,
  type GuestChoice,
  type SelectionStep,
} from "@/lib/wheel/participants";
import { getNiche, isNicheId } from "@/niches";
import type { ModuleHostProps } from "../../types";
import { useWheelEntries } from "../useWheelEntries";
import { GuestChoices } from "./GuestChoices";
import { OwnEntries } from "./OwnEntries";
import { TakenOff } from "./TakenOff";

/**
 * The Lucky wheel's section of the control panel: who is on the wheel. The
 * host ticks guests, adds own or suggested entries, and takes entries off
 * and puts them back, before Start and while the wheel runs.
 */
export function WheelHost({ event, members, code, hostKey }: ModuleHostProps) {
  const { t } = useTranslation();
  const { entries, reload } = useWheelEntries(event.id);
  const { busy, error, run } = useHostAction(wheelErrorKey, "host");
  const firstOpen = useRef(true);

  const list = entries.status === "ready" ? entries.value : [];
  const ended = event.status === "ended";
  const choices = guestChoices(members, list, event.language);
  const full = wheelIsFull(list);
  const onWheel = list.filter((e) => e.state === "on").length;
  const suggestions = isNicheId(event.niche) ? getNiche(event.niche).wheel : [];

  /** Sends one change; true when it was saved. */
  async function send(change: WheelChange): Promise<boolean> {
    const result = await run(
      () => updateWheel({ code, key: hostKey, change }),
      `wheel_${change.type}`,
    );
    return result.ok;
  }

  /** Sends steps one after the other and stops at the first that fails. */
  async function sendAll(steps: SelectionStep[]) {
    for (const step of steps) {
      if (!(await send(step))) break;
    }
    reload();
  }

  async function sendOne(change: WheelChange): Promise<boolean> {
    const saved = await send(change);
    if (saved) reload();
    return saved;
  }

  // The first time the section shows an empty wheel, everyone joins it.
  useEffect(() => {
    if (!firstOpen.current || entries.status !== "ready" || ended) return;
    firstOpen.current = false;
    if (entries.value.length === 0 && choices.length > 0) {
      void sendAll(selectAllSteps(choices, entries.value));
    }
    // Runs once, when the first list arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.status]);

  function toggle(choice: GuestChoice) {
    if (choice.entryId) {
      void sendOne({
        type: choice.onWheel ? "take_off" : "put_back",
        id: choice.entryId,
      });
    } else {
      void sendOne({ type: "add_guests", ids: [choice.userId] });
    }
  }

  const nameOf = (entry: WheelEntryView) =>
    entry.label ?? choices.find((c) => c.userId === entry.memberId)?.name ?? "";

  return (
    <section
      data-testid="wheel-host"
      aria-label={t("modules.wheel.name")}
      className="space-y-4"
    >
      {entries.status === "error" && (
        <ErrorLine>{t("modules.wheel.host.loadFailed")}</ErrorLine>
      )}
      <p className="text-sm text-ink-muted" role="status">
        {t("modules.wheel.host.count", {
          count: onWheel,
          max: wheelLimits.perEvent,
        })}
      </p>
      <GuestChoices
        choices={choices}
        disabled={busy || ended}
        canAddNew={!full}
        onToggle={toggle}
        onAll={() => void sendAll(selectAllSteps(choices, list))}
        onNone={() => void sendAll(selectNoneSteps(choices))}
      />
      <OwnEntries
        entries={customEntries(list, "on")}
        suggestions={openSuggestions(suggestions, event.language, list)}
        disabled={busy || ended}
        full={full}
        onAdd={(label) => sendOne({ type: "add_custom", label })}
        onTakeOff={(id) => void sendOne({ type: "take_off", id })}
      />
      <TakenOff
        entries={takenOff(list)}
        nameOf={nameOf}
        disabled={busy || ended}
        onPutBack={(id) => void sendOne({ type: "put_back", id })}
        onRemove={(id) => void sendOne({ type: "remove", id })}
      />
      {error && <ErrorLine>{error}</ErrorLine>}
    </section>
  );
}
