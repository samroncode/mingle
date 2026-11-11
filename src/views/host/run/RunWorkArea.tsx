import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { orderActivities } from "@/lib/host/host-panel";
import { isModuleId } from "@/modules/registry";
import { hasLive } from "../hasLive";
import { RunningLive } from "../RunningLive";
import { TvNow } from "../TopBar";
import { ActivityRows, OtherActivities } from "./ActivityRows";

interface RunWorkAreaProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  ended: boolean;
  phone: boolean;
}

/**
 * Run, the work area. Nothing running: the party screen is on the TV and the
 * enabled activities are rows, one of them up next. An activity running: its
 * Live part is the one paper surface and the others wait without buttons.
 */
export function RunWorkArea({
  event,
  members,
  hostKey,
  ended,
  phone,
}: RunWorkAreaProps) {
  const { t } = useTranslation();
  if (ended || event.status === "ended") {
    return (
      <div data-testid="run-work-area">
        <p className="font-display text-2xl font-bold">
          {t("hostPanel.ended")}
        </p>
      </div>
    );
  }
  const { enabled } = orderActivities(event.enabled_modules);
  const id = event.current_module;
  if (hasLive(event) && isModuleId(id)) {
    return (
      <div data-testid="run-work-area" className="space-y-8">
        <section
          data-testid="now-panel"
          aria-label={t("hostPanel.now.title")}
          className="space-y-4 rounded-lg border-[length:var(--border-thin)] border-edge bg-paper p-4 text-on-paper lg:p-8 lg:[&_button]:w-auto lg:[&_button]:px-8"
        >
          <p
            data-testid="tv-now"
            className="font-display text-xs font-bold tracking-wide uppercase opacity-70"
          >
            {t("hostPanel.tvNow")} <TvNow event={event} />
          </p>
          <RunningLive
            event={event}
            members={members}
            code={event.code}
            hostKey={hostKey}
            startDisabled={false}
            part={phone ? "status" : "all"}
          />
        </section>
        <OtherActivities
          ids={enabled.filter((other) => other !== id)}
          event={event}
          running={id}
        />
      </div>
    );
  }
  return (
    <div data-testid="run-work-area" className="space-y-6">
      <section data-testid="now-panel" aria-label={t("hostPanel.now.title")}>
        <h2
          data-testid="now-empty"
          className="font-display text-3xl leading-tight font-bold lg:text-4xl"
        >
          {t("hostPanel.run.idleTitle")}
        </h2>
        <p className="mt-2 text-ink-muted">
          {t(
            enabled.length > 0
              ? "hostPanel.run.idleHint"
              : "hostPanel.run.noActivities",
          )}
        </p>
      </section>
      <ActivityRows ids={enabled} event={event} hostKey={hostKey} />
    </div>
  );
}
