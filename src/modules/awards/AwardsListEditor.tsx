import { useTranslation } from "react-i18next";
import { PickListEditor } from "@/components/wizard/PickListEditor";
import { Input } from "@/components/ui/input";
import type { Language } from "@/i18n/language";
import { awardsLimits } from "@/lib/schemas/awards";
import {
  invalidOwnAwardKeys,
  type AwardsAction,
  type AwardsDraft,
  type AwardsItem,
  type OwnCategory,
} from "@/lib/wizard/awards";
import { getNiche, type NicheId } from "@/niches";

/** The form for one of the host's own categories. */
function OwnCategoryForm({
  own,
  n,
  invalid,
  dispatch,
}: {
  own: OwnCategory;
  /** The category's number as shown. */
  n: number;
  invalid: boolean;
  dispatch: (action: AwardsAction) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Input
        value={own.text}
        maxLength={awardsLimits.text}
        aria-label={t("wizard.awards.categoryText", { n })}
        aria-invalid={invalid}
        placeholder={t("wizard.awards.categoryPlaceholder")}
        onChange={(event) =>
          dispatch({
            type: "edit_own",
            key: own.key,
            change: { text: event.target.value },
          })
        }
      />
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t("wizard.awards.errors.empty", { n, max: awardsLimits.text })}
        </p>
      )}
    </div>
  );
}

function BuiltinCategory({ text }: { text: string }) {
  return <p className="min-w-0 flex-1 font-medium">{text}</p>;
}

interface AwardsListEditorProps {
  niche: NicheId;
  language: Language;
  awards: AwardsDraft;
  dispatch: (action: AwardsAction) => void;
}

/**
 * The awards' category list as the host edits it: the categories in order,
 * ready-made ones to add, and the host's own.
 */
export function AwardsListEditor({
  niche,
  language,
  awards,
  dispatch,
}: AwardsListEditorProps) {
  const { t } = useTranslation();
  const content = getNiche(niche).awards;
  const builtin = new Map(content.map((a) => [a.id, a]));
  const invalidKeys = new Set(invalidOwnAwardKeys(awards));
  const picked = new Set(
    awards.items.flatMap((item) => (item.kind === "builtin" ? [item.id] : [])),
  );

  function renderItem(item: AwardsItem, index: number) {
    if (item.kind === "own") {
      return (
        <OwnCategoryForm
          own={item}
          n={index + 1}
          invalid={invalidKeys.has(item.key)}
          dispatch={dispatch}
        />
      );
    }
    const ready = builtin.get(item.id);
    return ready ? <BuiltinCategory text={ready.texts[language]} /> : null;
  }

  const available = content
    .filter((a) => !picked.has(a.id))
    .map((ready) => ({
      id: ready.id,
      addLabel: t("wizard.awards.addCategory", { text: ready.texts[language] }),
      content: <BuiltinCategory text={ready.texts[language]} />,
    }));

  return (
    <PickListEditor
      id="awards"
      items={awards.items}
      seeded={awards.seeded}
      limit={awardsLimits.categories}
      labels={{
        count: t("wizard.awards.count", {
          count: awards.items.length,
          max: awardsLimits.categories,
        }),
        empty: t("wizard.awards.empty"),
        addOwn: t("wizard.awards.addOwn"),
        full: t("wizard.awards.full", { max: awardsLimits.categories }),
        more: t("wizard.awards.more"),
        add: t("wizard.awards.add"),
        moveUp: (n) => t("wizard.awards.moveUp", { n }),
        moveDown: (n) => t("wizard.awards.moveDown", { n }),
        remove: (n) => t("wizard.awards.remove", { n }),
      }}
      available={available}
      renderItem={renderItem}
      dispatch={dispatch}
    />
  );
}
