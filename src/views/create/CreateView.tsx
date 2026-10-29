import { ErrorLine } from "@/components/ErrorLine";
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { NicheTheme } from "@/components/NicheTheme";
import { Button } from "@/components/ui/button";
import { useCreateEvent } from "@/hooks/useCreateEvent";
import { isLanguage } from "@/i18n/language";
import type { CreateEventResponse } from "@/lib/schemas/host-actions";
import { addMyEvent } from "@/lib/guest/my-events";
import { moduleDefinitions } from "@/modules/definitions";
import { isModuleId } from "@/modules/registry";
import { clearDraft, loadDraft, saveDraft } from "@/lib/wizard/draft-storage";
import { createErrorKey } from "@/lib/wizard/create-error";
import {
  firstInvalidDraftStep,
  initialDraft,
  isSkippable,
  stepInvalidFields,
  stepIsInvalid,
  stepsFor,
  wizardReducer,
} from "@/lib/wizard/state";
import { DoneScreen } from "./DoneScreen";
import { MenuStep, ScheduleStep, WelcomeStep, WifiStep } from "./party-steps";
import { ActivitiesStep, LanguageStep, NicheStep, SummaryStep } from "./steps";

export function CreateView() {
  const { t, i18n } = useTranslation();
  const [draft, dispatch] = useReducer(
    wizardReducer,
    undefined,
    () =>
      loadDraft() ??
      initialDraft(
        isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en",
      ),
  );
  const [created, setCreated] = useState<CreateEventResponse>();
  const { busy, error, create } = useCreateEvent((event) => {
    addMyEvent({ ...event, niche: draft.niche, createdAt: Date.now() });
    clearDraft();
    setCreated(event);
  });

  useEffect(() => {
    if (!created) saveDraft(draft);
  }, [draft, created]);

  const steps = stepsFor(draft);
  const stepIndex = steps.indexOf(draft.step);
  // The quiz and awards steps come from their activity's definition.
  const ModuleStep = isModuleId(draft.step)
    ? moduleDefinitions[draft.step]?.WizardStep
    : undefined;
  const isFirst = stepIndex === 0;
  const isLast = draft.step === "summary";
  const invalid = stepInvalidFields(draft.party, draft.step);
  const blocked = stepIsInvalid(draft, draft.step);

  if (created) {
    return (
      <NicheTheme niche={draft.niche}>
        <DoneScreen code={created.code} hostKey={created.key} />
      </NicheTheme>
    );
  }

  return (
    <NicheTheme niche={draft.niche}>
      <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-5">
        <header className="space-y-2">
          <p className="font-display text-sm font-bold text-ink-muted">
            {t("wizard.progress", {
              current: stepIndex + 1,
              total: steps.length,
            })}
          </p>
          <div
            aria-hidden="true"
            className="h-3 overflow-hidden rounded-pill border-[length:var(--border-thin)] border-line-strong bg-surface-sunken"
          >
            <div
              className="h-full bg-champagne"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
          <h1 className="font-display text-3xl leading-tight font-extrabold">
            {t(`wizard.steps.${draft.step}`)}
          </h1>
        </header>

        <div className="flex-1 space-y-4">
          {draft.step === "niche" && (
            <NicheStep
              value={draft.niche}
              onSelect={(niche) => dispatch({ type: "select_niche", niche })}
            />
          )}
          {draft.step === "language" && (
            <LanguageStep
              value={draft.language}
              onSelect={(language) =>
                dispatch({ type: "set_language", language })
              }
            />
          )}
          {draft.step === "activities" && (
            <ActivitiesStep
              enabled={draft.enabledModules}
              onToggle={(module) => dispatch({ type: "toggle_module", module })}
            />
          )}
          {ModuleStep && <ModuleStep draft={draft} dispatch={dispatch} />}
          {draft.step === "welcome" && (
            <WelcomeStep
              value={draft.party.welcome}
              invalid={invalid}
              onChange={(text) => dispatch({ type: "set_welcome", text })}
            />
          )}
          {draft.step === "menu" && (
            <MenuStep
              menu={draft.party.menu}
              invalid={invalid}
              onChange={(menu) => dispatch({ type: "set_menu", menu })}
            />
          )}
          {draft.step === "schedule" && (
            <ScheduleStep
              schedule={draft.party.schedule}
              invalid={invalid}
              onChange={(schedule) =>
                dispatch({ type: "set_schedule", schedule })
              }
            />
          )}
          {draft.step === "wifi" && (
            <WifiStep
              party={draft.party}
              invalid={invalid}
              onWifiChange={(ssid, password) =>
                dispatch({ type: "set_wifi", ssid, password })
              }
              onMusicChange={(url) => dispatch({ type: "set_music_url", url })}
            />
          )}
          {draft.step === "summary" && (
            <SummaryStep
              draft={draft}
              onEdit={(step) => dispatch({ type: "go_to", step })}
            />
          )}

          {error && <ErrorLine>{t(createErrorKey(error))}</ErrorLine>}
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-3 border-t-[length:var(--border-thin)] border-line bg-surface px-4 py-3">
          {!isFirst && (
            <Button
              variant="outline"
              size="lg"
              className="w-auto"
              disabled={busy}
              onClick={() => dispatch({ type: "back" })}
            >
              {t("common.back")}
            </Button>
          )}
          {isLast ? (
            <Button
              size="lg"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                const step = firstInvalidDraftStep(draft);
                if (step) dispatch({ type: "go_to", step });
                else void create(draft);
              }}
            >
              {busy ? t("wizard.creating") : t("wizard.create")}
            </Button>
          ) : (
            <>
              {isSkippable(draft.step) && (
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-auto"
                  onClick={() => dispatch({ type: "skip" })}
                >
                  {t("wizard.skip")}
                </Button>
              )}
              <Button
                size="lg"
                className="flex-1"
                disabled={blocked}
                onClick={() => dispatch({ type: "next" })}
              >
                {t("common.next")}
              </Button>
            </>
          )}
        </div>
      </div>
    </NicheTheme>
  );
}
