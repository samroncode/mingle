import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { partyLimits } from "@/lib/schemas/party";
import type { PartyField, PartyForm, ScheduleLine } from "@/lib/wizard/state";
import { LineControls } from "./LineControls";

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function replaceItem<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** The i18n message for each invalid field on the step. */
function FieldErrors({ fields }: { fields: readonly PartyField[] }) {
  const { t } = useTranslation();
  return (
    <>
      {fields.map((field) => (
        <ErrorLine key={field}>{t(`wizard.errors.${field}`)}</ErrorLine>
      ))}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-display text-base font-bold">{label}</span>
      {children}
      {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
    </label>
  );
}

export function WelcomeStep({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid: readonly PartyField[];
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Field label={t("wizard.welcome.label")} hint={t("wizard.welcome.hint")}>
        <Textarea
          value={value}
          maxLength={partyLimits.welcome}
          aria-invalid={invalid.length > 0}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <FieldErrors fields={invalid} />
    </div>
  );
}

export function MenuStep({
  menu,
  invalid,
  onChange,
}: {
  menu: readonly string[];
  invalid: readonly PartyField[];
  onChange: (menu: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {menu.map((line, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            value={line}
            maxLength={partyLimits.line}
            aria-label={t("wizard.menu.line", { n: index + 1 })}
            onChange={(event) =>
              onChange(replaceItem(menu, index, event.target.value))
            }
          />
          <LineControls
            index={index}
            count={menu.length}
            onMove={(from, to) => onChange(moveItem(menu, from, to))}
            onRemove={(i) => onChange(removeItem(menu, i))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="lg"
        disabled={menu.length >= partyLimits.lines}
        onClick={() => onChange([...menu, ""])}
      >
        {t("wizard.menu.add")}
      </Button>
      <FieldErrors fields={invalid} />
    </div>
  );
}

export function ScheduleStep({
  schedule,
  invalid,
  onChange,
}: {
  schedule: readonly ScheduleLine[];
  invalid: readonly PartyField[];
  onChange: (schedule: ScheduleLine[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {schedule.map((line, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            type="time"
            className="w-28 shrink-0"
            value={line.time}
            aria-label={t("wizard.schedule.time", { n: index + 1 })}
            onChange={(event) =>
              onChange(
                replaceItem(schedule, index, {
                  ...line,
                  time: event.target.value,
                }),
              )
            }
          />
          <Input
            value={line.title}
            maxLength={partyLimits.line}
            aria-label={t("wizard.schedule.title", { n: index + 1 })}
            onChange={(event) =>
              onChange(
                replaceItem(schedule, index, {
                  ...line,
                  title: event.target.value,
                }),
              )
            }
          />
          <LineControls
            index={index}
            count={schedule.length}
            onMove={(from, to) => onChange(moveItem(schedule, from, to))}
            onRemove={(i) => onChange(removeItem(schedule, i))}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="lg"
        disabled={schedule.length >= partyLimits.lines}
        onClick={() => onChange([...schedule, { time: "", title: "" }])}
      >
        {t("wizard.schedule.add")}
      </Button>
      <FieldErrors fields={invalid} />
    </div>
  );
}

export function WifiStep({
  party,
  invalid,
  onWifiChange,
  onMusicChange,
}: {
  party: Pick<PartyForm, "wifiSsid" | "wifiPassword" | "musicUrl">;
  invalid: readonly PartyField[];
  onWifiChange: (ssid: string, password: string) => void;
  onMusicChange: (url: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Field label={t("wizard.wifi.ssid")}>
        <Input
          value={party.wifiSsid}
          maxLength={partyLimits.ssid}
          autoCapitalize="none"
          aria-invalid={invalid.includes("wifi")}
          onChange={(event) =>
            onWifiChange(event.target.value, party.wifiPassword)
          }
        />
      </Field>
      <Field
        label={t("wizard.wifi.password")}
        hint={t("wizard.wifi.passwordHint")}
      >
        <Input
          value={party.wifiPassword}
          maxLength={partyLimits.password}
          autoCapitalize="none"
          onChange={(event) => onWifiChange(party.wifiSsid, event.target.value)}
        />
      </Field>
      <Field label={t("wizard.music.label")} hint={t("wizard.music.hint")}>
        <Input
          type="url"
          inputMode="url"
          value={party.musicUrl}
          maxLength={partyLimits.musicUrl}
          placeholder={t("wizard.music.placeholder")}
          aria-invalid={invalid.includes("musicUrl")}
          onChange={(event) => onMusicChange(event.target.value)}
        />
      </Field>
      <FieldErrors fields={invalid} />
    </div>
  );
}
