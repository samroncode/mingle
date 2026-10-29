import { ErrorLine } from "@/components/ErrorLine";
import { Lock } from "lucide-react";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HotTakeView } from "@/api/hottakes";
import type { EventRow } from "@/api/events";
import { updateHotTakes } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHostAction } from "@/hooks/useHostAction";
import type { Language } from "@/i18n/language";
import {
  hotTakesEditErrorKey,
  hotTakesToDraft,
  saveHotTakesEdit,
} from "@/lib/host/hottakes-edit";
import { hotTakesReducer } from "@/lib/wizard/hottakes";
import type { NicheId } from "@/niches";
import { HotTakesListEditor } from "../HotTakesListEditor";

interface HotTakesEditProps {
  event: EventRow;
  niche: NicheId;
  language: Language;
  hostKey: string;
  /** Every hot take, as the host reads them. */
  takes: HotTakeView[];
  onDone: () => void;
}

/**
 * The control panel's hot takes editor: revealed hot takes locked, the rest in
 * the wizard's hot takes editor. Saving replaces every unrevealed hot take.
 */
export function HotTakesEdit({
  event,
  niche,
  language,
  hostKey,
  takes,
  onDone,
}: HotTakesEditProps) {
  const { t } = useTranslation();
  // Read once: the list the host edits doesn't change under their fingers.
  const [start] = useState(() => hotTakesToDraft(niche, language, takes));
  const [takesDraft, dispatch] = useReducer(hotTakesReducer, start.draft);
  const [incomplete, setIncomplete] = useState(false);
  const { busy, error, run } = useHostAction(hotTakesEditErrorKey);

  async function save() {
    const result = await run(() =>
      saveHotTakesEdit(
        niche,
        language,
        takesDraft,
        { code: event.code, key: hostKey },
        updateHotTakes,
      ),
    );
    setIncomplete("invalid" in result);
    if (result.ok) onDone();
  }

  return (
    <div data-testid="hottakes-edit" className="space-y-4">
      {start.revealed.length > 0 && (
        <ol
          className="space-y-2"
          aria-label={t("modules.hottakes.edit.revealed")}
        >
          {start.revealed.map((take, index) => (
            <li key={take.id}>
              <Card className="p-3">
                <p className="font-display font-bold">
                  {index + 1}. {take.text}
                </p>
              </Card>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <Lock aria-hidden className="size-3" />
                {t("modules.hottakes.edit.locked")}
              </p>
            </li>
          ))}
        </ol>
      )}
      <HotTakesListEditor
        niche={niche}
        language={language}
        takes={takesDraft}
        dispatch={dispatch}
        lockedCount={start.revealed.length}
        hiddenIds={start.hiddenIds}
      />
      {(error ?? incomplete) && (
        <ErrorLine>
          {error ?? t("modules.hottakes.edit.errors.incomplete")}
        </ErrorLine>
      )}
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={() => void save()}>
          {t("modules.hottakes.edit.save")}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={onDone}>
          {t("modules.hottakes.edit.cancel")}
        </Button>
      </div>
    </div>
  );
}
