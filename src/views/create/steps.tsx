import type { ParseKeys, TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supportedLanguages, type Language } from "@/i18n/language";
import { toAwardCategories } from "@/lib/wizard/awards";
import { toQuizQuestions } from "@/lib/wizard/quiz";
import { toParty, type WizardDraft, type WizardStep } from "@/lib/wizard/state";
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

type SummaryRow = { step: WizardStep; label: string; value: string };

/** One summary row per party step; skipped or empty parts read "Skipped". */
function partyRows(draft: WizardDraft, t: TFunction): SummaryRow[] {
  const party = toParty(draft.party);
  const skipped = t("wizard.summary.skipped");
  return [
    {
      step: "welcome",
      label: t("wizard.steps.welcome"),
      value: party.welcome ?? skipped,
    },
    {
      step: "menu",
      label: t("wizard.steps.menu"),
      value: party.menu?.join(", ") ?? skipped,
    },
    {
      step: "schedule",
      label: t("wizard.steps.schedule"),
      value:
        party.schedule?.map((l) => `${l.time} ${l.title}`).join(", ") ??
        skipped,
    },
    {
      step: "wifi",
      label: t("wizard.steps.wifi"),
      value:
        [party.wifi?.ssid, party.musicUrl].filter(Boolean).join(", ") ||
        skipped,
    },
  ];
}

export function SummaryStep({
  draft,
  onEdit,
}: {
  draft: WizardDraft;
  onEdit: (step: WizardStep) => void;
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
    ...(draft.enabledModules.includes("quiz")
      ? [
          {
            step: "quiz" as const,
            label: t("wizard.steps.quiz"),
            value: t("wizard.summary.quizQuestions", {
              count: toQuizQuestions(draft.niche, draft.language, draft.quiz)
                .length,
            }),
          },
        ]
      : []),
    ...(draft.enabledModules.includes("awards")
      ? [
          {
            step: "awards" as const,
            label: t("wizard.steps.awards"),
            value: t("wizard.summary.awardCategories", {
              count: toAwardCategories(
                draft.niche,
                draft.language,
                draft.awards,
              ).length,
            }),
          },
        ]
      : []),
    ...partyRows(draft, t),
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
