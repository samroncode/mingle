import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { orderActivities } from "@/lib/host/host-panel";
import { moduleDefinitions } from "@/modules/definitions";
import { RunControls } from "@/modules/RunControls";
import { isModuleId, type ModuleId } from "@/modules/registry";
import type { ActivityCounts, ModuleDefinition } from "@/modules/types";
import { useActivitySummary } from "@/modules/useActivitySummary";
import { useActivitySwitch } from "../useActivitySwitch";
import { EditFold } from "./EditFold";

interface RowProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

interface CellProps extends RowProps {
  id: ModuleId;
  running: ModuleId | null;
  open: boolean;
  onToggle: () => void;
  switching: boolean;
  onSwitch: (id: ModuleId, on: boolean) => void;
}

/** What the data hook of an activity gives its cell. */
interface CellData {
  summary?: string;
  counts?: ActivityCounts;
}

const startLabelKeys = {
  quiz: "modules.quiz.run.start",
  awards: "modules.awards.run.start",
  hottakes: "modules.hottakes.run.start",
} as const;

function definitionOf(id: ModuleId): ModuleDefinition | undefined {
  return Object.hasOwn(moduleDefinitions, id)
    ? moduleDefinitions[id]
    : undefined;
}

function ProgressBar({
  counts,
  name,
}: {
  counts: ActivityCounts;
  name: string;
}) {
  const { t } = useTranslation();
  if (counts.total <= 0) return null;
  const share = Math.min(100, Math.round((counts.done / counts.total) * 100));
  return (
    <div
      role="progressbar"
      aria-label={t("hostPanel.dashboard.progress", { name })}
      aria-valuemin={0}
      aria-valuemax={counts.total}
      aria-valuenow={counts.done}
      aria-valuetext={t("hostPanel.dashboard.progressText", {
        done: counts.done,
        total: counts.total,
      })}
      className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken"
    >
      <div className="h-full bg-sage" style={{ width: `${share}%` }} />
    </div>
  );
}

function StartButton({
  id,
  props,
  blocked,
}: {
  id: ModuleId;
  props: CellProps;
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const { event, hostKey, running, open, onToggle } = props;
  if (running === id) {
    return (
      <p className="font-display font-bold text-sage-text">
        {t("hostPanel.running")}
      </p>
    );
  }
  if (id === "competitions") {
    return (
      <Button
        disabled={blocked || event.status === "ended"}
        aria-expanded={open}
        onClick={onToggle}
      >
        {t("hostPanel.dashboard.showTable")}
      </Button>
    );
  }
  // The Lucky wheel gets its Start button with the spin ticket.
  if (id === "wheel" || !Object.hasOwn(startLabelKeys, id)) return null;
  return (
    <RunControls
      code={event.code}
      hostKey={hostKey}
      module={id}
      running={false}
      startDisabled={blocked}
      startLabelKey={startLabelKeys[id]}
      next={null}
    />
  );
}

function CellView({ data, ...props }: CellProps & { data: CellData }) {
  const { t } = useTranslation();
  const { id, running, open, onToggle } = props;
  const name = t(`modules.${id}.name`);
  const blocked = running !== null && running !== id;
  return (
    <li data-testid={`activity-${id}`} className="min-w-0 space-y-1.5">
      <h3 className="font-display text-lg font-bold">{name}</h3>
      <p className="text-sm text-ink-muted">{data.summary}</p>
      {data.counts && <ProgressBar counts={data.counts} name={name} />}
      {blocked && (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.stopFirst", {
            name: t(`modules.${running}.name`).toLowerCase(),
          })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <StartButton id={id} props={props} blocked={blocked} />
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          aria-label={t("hostPanel.dashboard.edit", { name })}
          onClick={onToggle}
        >
          {t(
            open
              ? "hostPanel.dashboard.close"
              : "hostPanel.dashboard.editShort",
          )}
        </Button>
      </div>
    </li>
  );
}

/** The cell reads its numbers through the hooks its definition names; the choice is fixed per activity. */
function CountsCell(props: CellProps & { definition: ModuleDefinition }) {
  const { definition, ...cell } = props;
  const counts = definition.useCounts?.(cell.event);
  const summary = useActivitySummary(cell.id, cell.event, counts ?? null);
  return <CellView {...cell} data={{ summary, counts }} />;
}

function SummaryCell(props: CellProps & { definition: ModuleDefinition }) {
  const { definition, ...cell } = props;
  const summary = definition.useSummary?.(cell.event);
  return <CellView {...cell} data={{ summary }} />;
}

function Cell(props: CellProps) {
  const definition = definitionOf(props.id);
  if (definition?.useCounts)
    return <CountsCell {...props} definition={definition} />;
  if (definition?.useSummary)
    return <SummaryCell {...props} definition={definition} />;
  return <CellView {...props} data={{}} />;
}

function UseSwitch({ id, props }: { id: ModuleId; props: CellProps }) {
  const { t } = useTranslation();
  const labelId = `use-${id}`;
  const on = props.event.enabled_modules.includes(id);
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={labelId} className="font-bold">
        {t("hostPanel.activity.use")}
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={on}
        disabled={props.switching || props.running === id}
        onCheckedChange={(next) => props.onSwitch(id, next)}
      />
    </div>
  );
}

function FoldBody({ id, props }: { id: ModuleId; props: CellProps }) {
  const { t } = useTranslation();
  const definition = definitionOf(id);
  const { event, members, hostKey, running } = props;
  return (
    <EditFold label={t(`modules.${id}.name`)}>
      <UseSwitch id={id} props={props} />
      {running === id && (
        <p className="text-sm text-on-paper-muted">
          {t("hostPanel.activity.stopToSwitchOff")}
        </p>
      )}
      {definition && (
        <definition.Host
          event={event}
          members={members}
          code={event.code}
          hostKey={hostKey}
          startDisabled={running !== null && running !== id}
          compact
        />
      )}
    </EditFold>
  );
}

/** A switched-off activity: its name and a switch. */
function OffRow({ id, props }: { id: ModuleId; props: CellProps }) {
  const { t } = useTranslation();
  return (
    <li
      data-testid={`activity-${id}`}
      className="flex items-center justify-between gap-3 border-b-[length:var(--border-thin)] border-line py-2"
    >
      <span id={`off-${id}`} className="min-w-0">
        <span className="block font-display font-bold">
          {t(`modules.${id}.name`)}
        </span>
        <span className="block text-sm text-ink-muted">
          {t(`modules.${id}.description`)}
        </span>
      </span>
      <Switch
        aria-labelledby={`off-${id}`}
        checked={false}
        disabled={props.switching}
        onCheckedChange={() => props.onSwitch(id, true)}
      />
    </li>
  );
}

/**
 * All enabled activities side by side, each with its summary, progress and a
 * Start button. Editing folds out under the row; switched-off ones wait,
 * collapsed, at the end.
 */
export function ActivitiesRow(props: RowProps) {
  const { t } = useTranslation();
  const { event } = props;
  const { busy, error, notice, toggle } = useActivitySwitch(
    event,
    props.hostKey,
  );
  const [openId, setOpenId] = useState<ModuleId>();
  const { enabled, disabled } = orderActivities(event.enabled_modules);
  const running = isModuleId(event.current_module)
    ? event.current_module
    : null;
  const shared = {
    ...props,
    running,
    switching: busy || event.status === "ended",
    onSwitch: (id: ModuleId, on: boolean) => {
      if (!on && openId === id) setOpenId(undefined);
      void toggle(id, on);
    },
  };
  const cell = (id: ModuleId): CellProps => ({
    ...shared,
    id,
    open: openId === id,
    onToggle: () => setOpenId((current) => (current === id ? undefined : id)),
  });
  return (
    <div className="space-y-2">
      {(error || notice) && <ErrorLine>{error ?? notice}</ErrorLine>}
      <ul
        className="grid gap-x-6 gap-y-4"
        style={{
          gridTemplateColumns: `repeat(${Math.max(enabled.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {enabled.map((id) => (
          <Cell key={id} {...cell(id)} />
        ))}
      </ul>
      {openId && enabled.includes(openId) && (
        <FoldBody id={openId} props={cell(openId)} />
      )}
      {disabled.length > 0 && (
        <details data-testid="disabled-activities">
          <summary className="cursor-pointer py-1 font-display font-bold text-ink-muted">
            {t("hostPanel.switchedOff", { count: disabled.length })}
          </summary>
          <ul>
            {disabled.map((id) => (
              <OffRow key={id} id={id} props={cell(id)} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
