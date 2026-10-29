import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { PanelSection } from "@/components/PanelSection";
import { Sticker } from "@/components/ui/sticker";
import { orderActivities } from "@/lib/host/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId, type ModuleId } from "@/modules/registry";
import type { ModuleDefinition } from "@/modules/types";

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
}

function Section({
  id,
  props,
  running,
  summary,
}: SectionProps & { summary?: string }) {
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

/** The activity sections: enabled in the wizard's order, the rest collapsed. */
export function Activities(props: ActivitiesProps) {
  const { t } = useTranslation();
  const { enabled, disabled } = orderActivities(props.event.enabled_modules);
  const running = isModuleId(props.event.current_module)
    ? props.event.current_module
    : null;
  return (
    <div className="space-y-4">
      {enabled.map((id) => (
        <ActivitySection key={id} id={id} props={props} running={running} />
      ))}
      {disabled.length > 0 && (
        <details data-testid="disabled-activities">
          <summary className="min-h-12 cursor-pointer py-3 font-display font-bold text-ink-muted">
            {t("hostPanel.switchedOff", { count: disabled.length })}
          </summary>
          <div className="space-y-4 pt-2">
            {disabled.map((id) => (
              <ActivitySection
                key={id}
                id={id}
                props={props}
                running={running}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
