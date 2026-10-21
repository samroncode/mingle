import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { NicheTheme } from "@/components/NicheTheme";
import { Button } from "@/components/ui/button";
import { useCreateEvent } from "@/hooks/useCreateEvent";
import { isLanguage } from "@/i18n/language";
import type { CreateEventResponse } from "@/lib/schemas/host-actions";
import { createErrorKey } from "@/lib/wizard/create-error";
import {
  initialDraft,
  isSkippable,
  stepInvalidFields,
  stepOrder,
  wizardReducer,
} from "@/lib/wizard/state";
import { DoneScreen } from "./create/DoneScreen";
import {
  MenuStep,
  ScheduleStep,
  WelcomeStep,
  WifiStep,
} from "./create/party-steps";
import {
  ActivitiesStep,
  LanguageStep,
  NicheStep,
  SummaryStep,
} from "./create/steps";

export function CreateView() {
  const { t, i18n } = useTranslation();
  const [draft, dispatch] = useReducer(wizardReducer, undefined, () =>
    initialDraft(
      isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en",
    ),
  );
  const [created, setCreated] = useState<CreateEventResponse>();
  const { busy, error, create } = useCreateEvent(setCreated);

  const stepIndex = stepOrder.indexOf(draft.step);
  const isFirst = stepIndex === 0;
  const isLast = draft.step === "summary";
  const invalid = stepInvalidFields(draft.party, draft.step);

  if (created) {
    return (
      <NicheTheme niche={draft.niche}>
        <DoneScreen code={created.code} hostKey={created.key} />
      </NicheTheme>
    );
  }

  return (
    <NicheTheme niche={draft.niche}>
      <div className="space-y-4">
        <header>
          <p className="text-sm text-muted-foreground">
            {t("wizard.progress", {
              current: stepIndex + 1,
              total: stepOrder.length,
            })}
          </p>
          <h1 className="text-2xl font-semibold">
            {t(`wizard.steps.${draft.step}`)}
          </h1>
        </header>

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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(createErrorKey(error))}
          </p>
        )}

        <div className="flex gap-2">
          {!isFirst && (
            <Button
              variant="outline"
              size="lg"
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
              onClick={() => void create(draft)}
            >
              {busy ? t("wizard.creating") : t("wizard.create")}
            </Button>
          ) : (
            <>
              {isSkippable(draft.step) && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => dispatch({ type: "skip" })}
                >
                  {t("wizard.skip")}
                </Button>
              )}
              <Button
                size="lg"
                className="flex-1"
                disabled={invalid.length > 0}
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
