import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { PickListEditor } from "@/components/wizard/PickListEditor";
import { Input } from "@/components/ui/input";
import type { Language } from "@/i18n/language";
import { hottakesLimits } from "@/lib/schemas/hottakes";
import {
  invalidOwnHotTakeKeys,
  type HotTakesAction,
  type HotTakesDraft,
  type HotTakesItem,
  type OwnHotTake,
} from "@/lib/wizard/hottakes";
import { getNiche, type NicheId } from "@/niches";

/** The form for one of the host's own hot takes. */
function OwnHotTakeForm({
  own,
  n,
  invalid,
  dispatch,
}: {
  own: OwnHotTake;
  /** The hot take's number as shown. */
  n: number;
  invalid: boolean;
  dispatch: (action: HotTakesAction) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Input
        value={own.text}
        maxLength={hottakesLimits.text}
        aria-label={t("wizard.hottakes.takeText", { n })}
        aria-invalid={invalid}
        placeholder={t("wizard.hottakes.takePlaceholder")}
        onChange={(event) =>
          dispatch({
            type: "edit_own",
            key: own.key,
            change: { text: event.target.value },
          })
        }
      />
      {invalid && (
        <ErrorLine>
          {t("wizard.hottakes.errors.empty", { n, max: hottakesLimits.text })}
        </ErrorLine>
      )}
    </div>
  );
}

function BuiltinHotTake({ text }: { text: string }) {
  return <p className="min-w-0 flex-1 font-medium">{text}</p>;
}

interface HotTakesListEditorProps {
  niche: NicheId;
  language: Language;
  takes: HotTakesDraft;
  dispatch: (action: HotTakesAction) => void;
  /** Revealed hot takes shown locked before the list; they count in the limit. */
  lockedCount?: number;
  /** Ready-made hot takes not to offer, such as ones already revealed. */
  hiddenIds?: readonly string[];
}

/**
 * The hot take list as the host edits it, in the wizard and in the
 * control panel: the hot takes in order, ready-made ones to add, and the
 * host's own.
 */
export function HotTakesListEditor({
  niche,
  language,
  takes,
  dispatch,
  lockedCount = 0,
  hiddenIds = [],
}: HotTakesListEditorProps) {
  const { t } = useTranslation();
  const content = getNiche(niche).hottakes;
  const builtin = new Map(content.map((h) => [h.id, h]));
  const invalidKeys = new Set(invalidOwnHotTakeKeys(takes));
  const leftOut = new Set([
    ...hiddenIds,
    ...takes.items.flatMap((item) =>
      item.kind === "builtin" ? [item.id] : [],
    ),
  ]);

  function renderItem(item: HotTakesItem, index: number) {
    if (item.kind === "own") {
      return (
        <OwnHotTakeForm
          own={item}
          n={lockedCount + index + 1}
          invalid={invalidKeys.has(item.key)}
          dispatch={dispatch}
        />
      );
    }
    const ready = builtin.get(item.id);
    return ready ? <BuiltinHotTake text={ready.texts[language]} /> : null;
  }

  const available = content
    .filter((h) => !leftOut.has(h.id))
    .map((ready) => ({
      id: ready.id,
      addLabel: t("wizard.hottakes.addTake", { text: ready.texts[language] }),
      content: <BuiltinHotTake text={ready.texts[language]} />,
    }));

  return (
    <PickListEditor
      id="hottakes"
      items={takes.items}
      seeded={takes.seeded}
      limit={hottakesLimits.takes - lockedCount}
      firstNumber={lockedCount + 1}
      labels={{
        count: t("wizard.hottakes.count", {
          count: lockedCount + takes.items.length,
          max: hottakesLimits.takes,
        }),
        empty: t("wizard.hottakes.empty"),
        addOwn: t("wizard.hottakes.addOwn"),
        full: t("wizard.hottakes.full", { max: hottakesLimits.takes }),
        more: t("wizard.hottakes.more"),
        add: t("wizard.hottakes.add"),
        moveUp: (n) => t("wizard.hottakes.moveUp", { n }),
        moveDown: (n) => t("wizard.hottakes.moveDown", { n }),
        remove: (n) => t("wizard.hottakes.remove", { n }),
      }}
      available={available}
      renderItem={renderItem}
      dispatch={dispatch}
    />
  );
}
