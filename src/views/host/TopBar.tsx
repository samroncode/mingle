import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { EventRow, MemberRow } from "@/api/events";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { useIsPhone } from "@/hooks/useIsPhone";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import { ViewSwitch } from "./ViewSwitch";
import { countGuests } from "@/partyscreen/guests";
import { tvNow } from "@/lib/host/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";
import type { ModuleDefinition } from "@/modules/types";

interface TopBarProps {
  event: EventRow;
  members: MemberRow[];
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

export function TvNow({ event }: { event: EventRow }) {
  const definition = definitionOf(event);
  return definition && definition.useProgress ? (
    <WithProgress event={event} definition={definition} />
  ) : (
    <TvText event={event} progress={undefined} />
  );
}

/**
 * The always-visible bar, one line: logo, the Run / Prepare switch (wide
 * screens; a phone has tabs at the bottom), language, guests and the event
 * code. In Prepare, while an activity runs, a second line says what the TV
 * shows and leads back to Run.
 */
export function TopBar({ event, members }: TopBarProps) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const location = usePanelLocation();
  const running = !!event.current_module && event.status !== "ended";

  return (
    <div
      data-testid="host-top-bar"
      className="sticky top-0 z-10 -mx-4 border-b-[length:var(--border-chunky)] border-edge bg-forest px-4 text-on-forest"
    >
      <div className="flex min-h-14 items-center gap-2 sm:gap-4">
        <Logo className="text-xl" />
        <div className="flex flex-1 justify-center">
          {!phone && <ViewSwitch variant="bar" />}
        </div>
        <LanguageSwitcher />
        <Link
          to={location.to("prepare", "guests")}
          data-testid="guest-count"
          className="inline-flex min-h-12 items-center text-sm underline-offset-4 hover:underline"
        >
          {t("hostPanel.guests", { count: countGuests(members) })}
        </Link>
        <span
          data-testid="top-bar-code"
          className="rounded-sm bg-champagne px-2 py-0.5 font-display text-lg font-extrabold tracking-widest text-on-bright"
        >
          {event.code}
        </span>
      </div>
      {running && location.view === "prepare" && (
        <Link
          to={location.to("run")}
          data-testid="tv-now"
          className="block pb-2 font-body text-base text-on-forest underline-offset-4 hover:underline"
        >
          {t("hostPanel.tvNow")} <TvNow event={event} />
        </Link>
      )}
    </div>
  );
}
