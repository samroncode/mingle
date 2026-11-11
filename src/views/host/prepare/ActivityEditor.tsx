import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { ErrorLine } from "@/components/ErrorLine";
import { Sticker } from "@/components/ui/sticker";
import { Switch } from "@/components/ui/switch";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId, type ModuleId } from "@/modules/registry";
import { useActivitySwitch } from "../useActivitySwitch";

interface ActivityEditorProps {
  id: ModuleId;
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

/**
 * One activity in Prepare: its name with the "Use this activity" switch on
 * the same line, then its own `Host` part. A switched-off activity shows its
 * description and the switch.
 */
export function ActivityEditor({
  id,
  event,
  members,
  hostKey,
}: ActivityEditorProps) {
  const { t } = useTranslation();
  const { busy, error, notice, toggle } = useActivitySwitch(event, hostKey);
  const definition = Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
  const on = event.enabled_modules.includes(id);
  const running = isModuleId(event.current_module)
    ? event.current_module
    : null;
  const labelId = `use-${id}`;
  return (
    <div data-testid={`activity-${id}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-bold">
            {t(`modules.${id}.name`)}
          </h2>
          {running === id && (
            <Sticker color="sage" lean="left">
              {t("hostPanel.running")}
            </Sticker>
          )}
        </div>
        <div className="flex min-h-12 items-center gap-3">
          <span id={labelId} className="font-bold">
            {t("hostPanel.activity.use")}
          </span>
          <Switch
            aria-labelledby={labelId}
            checked={on}
            disabled={busy || event.status === "ended" || running === id}
            onCheckedChange={(next) => void toggle(id, next)}
          />
        </div>
      </div>
      {(error || notice) && <ErrorLine>{error ?? notice}</ErrorLine>}
      {running === id && (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.activity.stopToSwitchOff")}
        </p>
      )}
      {on ? (
        definition && (
          <definition.Host
            event={event}
            members={members}
            code={event.code}
            hostKey={hostKey}
            startDisabled={running !== null && running !== id}
          />
        )
      ) : (
        <p className="text-ink-muted">{t(`modules.${id}.description`)}</p>
      )}
    </div>
  );
}
