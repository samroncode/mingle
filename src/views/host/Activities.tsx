import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { orderActivities } from "@/lib/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId, type ModuleId } from "@/modules/registry";

interface ActivitiesProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

function Section({
  id,
  props,
  running,
}: {
  id: ModuleId;
  props: ActivitiesProps;
  running: ModuleId | null;
}) {
  const { t } = useTranslation();
  const definition = Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
  const name = t(`modules.${id}.name`);
  const blocked = running !== null && running !== id;
  return (
    <section data-testid={`activity-${id}`} className="space-y-2">
      {definition ? (
        <definition.Host
          event={props.event}
          members={props.members}
          code={props.event.code}
          hostKey={props.hostKey}
          startDisabled={blocked}
        />
      ) : (
        <h2 className="font-semibold">{name}</h2>
      )}
      {blocked && (
        <p className="text-sm text-muted-foreground">
          {t("hostPanel.stopFirst", {
            name: t(`modules.${running}.name`).toLowerCase(),
          })}
        </p>
      )}
    </section>
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
        <Section key={id} id={id} props={props} running={running} />
      ))}
      {disabled.length > 0 && (
        <details data-testid="disabled-activities">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {t("hostPanel.switchedOff", { count: disabled.length })}
          </summary>
          <div className="space-y-4 pt-2">
            {disabled.map((id) => (
              <Section key={id} id={id} props={props} running={running} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
