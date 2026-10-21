import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supportedLanguages, type Language } from "@/i18n/language";
import type { WizardDraft } from "@/lib/wizard/state";
import { moduleIds, type ModuleId } from "@/modules/registry";
import { niches, type NicheId } from "@/niches";
import { nicheIds } from "@/niches/ids";
import { ChoiceButton } from "./ChoiceButton";

export function NicheStep({
  value,
  onSelect,
}: {
  value: NicheId;
  onSelect: (niche: NicheId) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {nicheIds.map((id) => {
        const niche = niches[id];
        return (
          <ChoiceButton
            key={id}
            selected={id === value}
            onSelect={() => onSelect(id)}
          >
            <span className="block font-medium">
              {t(niche.nameKey as ParseKeys)}
            </span>
            <span className="block text-sm opacity-80">
              {t(niche.descriptionKey as ParseKeys)}
            </span>
          </ChoiceButton>
        );
      })}
    </div>
  );
}

export function LanguageStep({
  value,
  onSelect,
}: {
  value: Language;
  onSelect: (language: Language) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {supportedLanguages.map((language) => (
        <ChoiceButton
          key={language}
          selected={language === value}
          onSelect={() => onSelect(language)}
        >
          <span lang={language} className="font-medium">
            {t(`language.${language}`)}
          </span>
        </ChoiceButton>
      ))}
    </div>
  );
}

export function ActivitiesStep({
  enabled,
  onToggle,
}: {
  enabled: readonly ModuleId[];
  onToggle: (module: ModuleId) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {moduleIds.map((id) => (
        <Card key={id} className="flex-row items-center justify-between">
          <div>
            <CardTitle id={`activity-${id}`}>
              {t(`modules.${id}.name`)}
            </CardTitle>
            <CardDescription>{t(`modules.${id}.description`)}</CardDescription>
          </div>
          <Switch
            aria-labelledby={`activity-${id}`}
            checked={enabled.includes(id)}
            onCheckedChange={() => onToggle(id)}
          />
        </Card>
      ))}
      {enabled.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("wizard.activities.noneHint")}
        </p>
      )}
    </div>
  );
}

export function SummaryStep({
  draft,
  onEdit,
}: {
  draft: WizardDraft;
  onEdit: (step: "niche" | "language" | "activities") => void;
}) {
  const { t } = useTranslation();
  const rows = [
    {
      step: "niche",
      label: t("wizard.steps.niche"),
      value: t(niches[draft.niche].nameKey as ParseKeys),
    },
    {
      step: "language",
      label: t("wizard.steps.language"),
      value: t(`language.${draft.language}`),
    },
    {
      step: "activities",
      label: t("wizard.steps.activities"),
      value:
        draft.enabledModules.length === 0
          ? t("wizard.summary.noActivities")
          : draft.enabledModules
              .map((id) => t(`modules.${id}.name`))
              .join(", "),
    },
  ] as const;

  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <Card key={row.step} className="flex-row items-center justify-between">
          <div>
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            aria-label={t("wizard.summary.change", { step: row.label })}
            onClick={() => onEdit(row.step)}
          >
            {t("wizard.summary.edit")}
          </button>
        </Card>
      ))}
    </dl>
  );
}
