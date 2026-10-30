import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { ErrorLine } from "@/components/ErrorLine";
import { PanelSection } from "@/components/PanelSection";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { Switch } from "@/components/ui/switch";
import { orderActivities } from "@/lib/host/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId, type ModuleId } from "@/modules/registry";
import type { ModuleDefinition } from "@/modules/types";
import { useActivitySwitch } from "./useActivitySwitch";

interface ActivitiesProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

/** Runs the definition's summary hook; its identity is fixed per activity. */
function WithSummary({
  definition,
  ...rest
}: SectionProps & { definition: ModuleDefinition }) {
  const summary = definition.useSummary?.(rest.props.event);
  return <Section {...rest} summary={summary} />;
}

interface SectionProps {
  id: ModuleId;
  props: ActivitiesProps;
  running: ModuleId | null;
  /** Whether a switch is being saved right now. */
  busy: boolean;
  onSwitch: (id: ModuleId, on: boolean) => void;
}

/** The on/off switch at the top of an enabled activity's section. */
function EnabledSwitch({ id, running, busy, onSwitch }: SectionProps) {
  const { t } = useTranslation();
  const labelId = `use-${id}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="font-bold">
          {t("hostPanel.activity.use")}
        </span>
        <Switch
          aria-labelledby={labelId}
          checked
          disabled={busy || running === id}
          onCheckedChange={() => onSwitch(id, false)}
        />
      </div>
      {running === id && (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.activity.stopToSwitchOff")}
        </p>
      )}
    </div>
  );
}

/** A switched-off activity: its name and a switch, nothing else. */
function SwitchedOff({ id, busy, onSwitch }: SectionProps) {
  const { t } = useTranslation();
  return (
    <Card
      data-testid={`activity-${id}`}
      className="flex-row items-center justify-between"
    >
      <div>
        <CardTitle id={`off-${id}`}>{t(`modules.${id}.name`)}</CardTitle>
        <CardDescription>{t(`modules.${id}.description`)}</CardDescription>
      </div>
      <Switch
        aria-labelledby={`off-${id}`}
        checked={false}
        disabled={busy}
        onCheckedChange={() => onSwitch(id, true)}
      />
    </Card>
  );
}

function Section({ summary, ...section }: SectionProps & { summary?: string }) {
  const { id, props, running } = section;
  const { t } = useTranslation();
  const definition = Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
  const blocked = running !== null && running !== id;
  return (
    <PanelSection
      testId={`activity-${id}`}
      title={t(`modules.${id}.name`)}
      summary={summary}
      openWhen={running === id}
      badge={
        running === id && (
          <Sticker color="sage" lean="left">
            {t("hostPanel.running")}
          </Sticker>
        )
      }
    >
      <EnabledSwitch {...section} />
      {definition && (
        <definition.Host
          event={props.event}
          members={props.members}
          code={props.event.code}
          hostKey={props.hostKey}
          startDisabled={blocked}
        />
      )}
      {blocked && (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.stopFirst", {
            name: t(`modules.${running}.name`).toLowerCase(),
          })}
        </p>
      )}
    </PanelSection>
  );
}

function ActivitySection(props: SectionProps) {
  const definition = Object.hasOwn(moduleDefinitions, props.id)
    ? moduleDefinitions[props.id]
    : undefined;
  return definition?.useSummary ? (
    <WithSummary {...props} definition={definition} />
  ) : (
    <Section {...props} />
  );
}

/**
 * The activity sections: enabled in their saved order, each with its switch;
 * switched-off ones are collapsed at the bottom.
 */
export function Activities(props: ActivitiesProps) {
  const { t } = useTranslation();
  const { busy, error, notice, toggle } = useActivitySwitch(
    props.event,
    props.hostKey,
  );
  const { enabled, disabled } = orderActivities(props.event.enabled_modules);
  const running = isModuleId(props.event.current_module)
    ? props.event.current_module
    : null;
  // Nothing changes after the evening has ended.
  const switching = busy || props.event.status === "ended";
  const shared = { props, running, busy: switching, onSwitch: toggle };
  return (
    <div className="space-y-4">
      {(error || notice) && <ErrorLine>{error ?? notice}</ErrorLine>}
      {enabled.map((id) => (
        <ActivitySection key={id} id={id} {...shared} />
      ))}
      {disabled.length > 0 && (
        <details data-testid="disabled-activities">
          <summary className="min-h-12 cursor-pointer py-3 font-display font-bold text-ink-muted">
            {t("hostPanel.switchedOff", { count: disabled.length })}
          </summary>
          <div className="space-y-4 pt-2">
            {disabled.map((id) => (
              <SwitchedOff key={id} id={id} {...shared} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
