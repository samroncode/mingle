import { ErrorLine } from "@/components/ErrorLine";
import { Lock } from "lucide-react";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AwardCategoryView } from "@/api/awards";
import type { EventRow } from "@/api/events";
import { updateAwards } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHostAction } from "@/hooks/useHostAction";
import type { Language } from "@/i18n/language";
import {
  awardsEditErrorKey,
  awardsToDraft,
  saveAwardsEdit,
} from "@/lib/host/awards-edit";
import { awardsReducer } from "@/lib/wizard/awards";
import type { NicheId } from "@/niches";
import { AwardsListEditor } from "../AwardsListEditor";

interface AwardsEditProps {
  event: EventRow;
  niche: NicheId;
  language: Language;
  hostKey: string;
  /** Every category of the awards, as the host reads them. */
  categories: AwardCategoryView[];
  onDone: () => void;
}

/**
 * The control panel's awards editor: revealed categories locked, the rest in
 * the wizard's awards editor. Saving replaces every unrevealed category.
 */
export function AwardsEdit({
  event,
  niche,
  language,
  hostKey,
  categories,
  onDone,
}: AwardsEditProps) {
  const { t } = useTranslation();
  // Read once: the list the host edits doesn't change under their fingers.
  const [start] = useState(() => awardsToDraft(niche, language, categories));
  const [awards, dispatch] = useReducer(awardsReducer, start.draft);
  const [incomplete, setIncomplete] = useState(false);
  const { busy, error, run } = useHostAction(awardsEditErrorKey);

  async function save() {
    const result = await run(() =>
      saveAwardsEdit(
        niche,
        language,
        awards,
        { code: event.code, key: hostKey },
        updateAwards,
      ),
    );
    setIncomplete("invalid" in result);
    if (result.ok) onDone();
  }

  return (
    <div data-testid="awards-edit" className="space-y-4">
      {start.revealed.length > 0 && (
        <ol
          className="space-y-2"
          aria-label={t("modules.awards.edit.revealed")}
        >
          {start.revealed.map((category, index) => (
            <li key={category.id}>
              <Card className="p-3">
                <p className="font-display font-bold">
                  {index + 1}. {category.text}
                </p>
              </Card>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <Lock aria-hidden className="size-3" />
                {t("modules.awards.edit.locked")}
              </p>
            </li>
          ))}
        </ol>
      )}
      <AwardsListEditor
        niche={niche}
        language={language}
        awards={awards}
        dispatch={dispatch}
        lockedCount={start.revealed.length}
        hiddenIds={start.hiddenIds}
      />
      {(error ?? incomplete) && (
        <ErrorLine>
          {error ?? t("modules.awards.edit.errors.incomplete")}
        </ErrorLine>
      )}
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={() => void save()}>
          {t("modules.awards.edit.save")}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={onDone}>
          {t("modules.awards.edit.cancel")}
        </Button>
      </div>
    </div>
  );
}
