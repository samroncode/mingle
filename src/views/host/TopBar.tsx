import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { setFlow } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import { countGuests } from "@/partyscreen/guests";
import { tvNow } from "@/lib/host/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";
import type { ModuleDefinition } from "@/modules/types";

interface TopBarProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

function definitionOf(event: EventRow): ModuleDefinition | undefined {
  const id = event.current_module;
  return isModuleId(id) ? moduleDefinitions[id] : undefined;
}

function TvText({
  event,
  progress,
}: {
  event: EventRow;
  progress: string | undefined;
}) {
  const { t } = useTranslation();
  const id = event.current_module;
  const name = isModuleId(id) ? t(`modules.${id}.name`) : undefined;
  const now = tvNow(event, name, progress);
  return <>{t(now.key, now.values)}</>;
}

/** Runs the definition's progress hook; its identity is fixed per activity. */
function WithProgress({
  event,
  definition,
}: {
  event: EventRow;
  definition: ModuleDefinition;
}) {
  const progress = definition.useProgress?.(event);
  return <TvText event={event} progress={progress} />;
}

function TvNow({ event }: { event: EventRow }) {
  const definition = definitionOf(event);
  return definition && definition.useProgress ? (
    <WithProgress event={event} definition={definition} />
  ) : (
    <TvText event={event} progress={undefined} />
  );
}

/** Always-visible bar: code, guests, what the TV shows and Stop. */
export function TopBar({ event, members, hostKey }: TopBarProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();
  const running = !!event.current_module && event.status !== "ended";

  const stop = () =>
    run(() =>
      setFlow({
        code: event.code,
        key: hostKey,
        move: { type: "stop_module" },
      }),
    );

  return (
    <div
      data-testid="host-top-bar"
      className="sticky top-0 z-10 -mx-4 space-y-1 border-b bg-background px-4 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-bold tracking-widest">
          {event.code}
        </span>
        <span data-testid="guest-count" className="text-sm">
          {t("hostPanel.guests", { count: countGuests(members) })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p data-testid="tv-now" className="text-sm text-muted-foreground">
          {t("hostPanel.tvNow")} <TvNow event={event} />
        </p>
        {running && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void stop()}
          >
            {t("hostPanel.stop")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
