import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { PickListEditor } from "@/components/wizard/PickListEditor";
import { Input } from "@/components/ui/input";
import type { Language } from "@/i18n/language";
import { competitionsLimits } from "@/lib/schemas/competitions";
import {
  invalidOwnCompetitionKeys,
  type CompetitionsAction,
  type CompetitionsDraft,
  type CompetitionsItem,
  type OwnCompetition,
} from "@/lib/wizard/competitions";
import { getNiche, type NicheId } from "@/niches";

/** The form for one of the host's own competitions. */
function OwnCompetitionForm({
  own,
  n,
  invalid,
  dispatch,
}: {
  own: OwnCompetition;
  /** The competition's number as shown. */
  n: number;
  invalid: boolean;
  dispatch: (action: CompetitionsAction) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Input
        value={own.name}
        maxLength={competitionsLimits.name}
        aria-label={t("wizard.competitions.nameLabel", { n })}
        aria-invalid={invalid}
        placeholder={t("wizard.competitions.namePlaceholder")}
        onChange={(event) =>
          dispatch({
            type: "edit_own",
            key: own.key,
            change: { name: event.target.value },
          })
        }
      />
      {invalid && (
        <ErrorLine>
          {t("wizard.competitions.errors.empty", {
            n,
            max: competitionsLimits.name,
          })}
        </ErrorLine>
      )}
    </div>
  );
}

function BuiltinCompetition({ name }: { name: string }) {
  return <p className="min-w-0 flex-1 font-medium">{name}</p>;
}

interface CompetitionsListEditorProps {
  niche: NicheId;
  language: Language;
  list: CompetitionsDraft;
  dispatch: (action: CompetitionsAction) => void;
}

/**
 * The competitions as the host picks them in the wizard: the ones picked so
 * far in order, the niche's suggestions to add, and the host's own.
 */
export function CompetitionsListEditor({
  niche,
  language,
  list,
  dispatch,
}: CompetitionsListEditorProps) {
  const { t } = useTranslation();
  const content = getNiche(niche).competitions;
  const builtin = new Map(content.map((c) => [c.id, c]));
  const invalidKeys = new Set(invalidOwnCompetitionKeys(list));
  const picked = new Set(
    list.items.flatMap((item) => (item.kind === "builtin" ? [item.id] : [])),
  );

  function renderItem(item: CompetitionsItem, index: number) {
    if (item.kind === "own") {
      return (
        <OwnCompetitionForm
          own={item}
          n={index + 1}
          invalid={invalidKeys.has(item.key)}
          dispatch={dispatch}
        />
      );
    }
    const ready = builtin.get(item.id);
    return ready ? <BuiltinCompetition name={ready.names[language]} /> : null;
  }

  const available = content
    .filter((c) => !picked.has(c.id))
    .map((ready) => ({
      id: ready.id,
      addLabel: t("wizard.competitions.addCompetition", {
        name: ready.names[language],
      }),
      content: <BuiltinCompetition name={ready.names[language]} />,
    }));

  return (
    <PickListEditor
      id="competitions"
      items={list.items}
      seeded={list.seeded}
      limit={competitionsLimits.perEvent}
      firstNumber={1}
      labels={{
        count: t("wizard.competitions.count", {
          count: list.items.length,
          max: competitionsLimits.perEvent,
        }),
        empty: t("wizard.competitions.empty"),
        addOwn: t("wizard.competitions.addOwn"),
        full: t("wizard.competitions.full", {
          max: competitionsLimits.perEvent,
        }),
        more: (count) => t("wizard.competitions.more", { count }),
        add: t("wizard.competitions.add"),
        moveUp: (n) => t("wizard.competitions.moveUp", { n }),
        moveDown: (n) => t("wizard.competitions.moveDown", { n }),
        remove: (n) => t("wizard.competitions.remove", { n }),
      }}
      available={available}
      renderItem={renderItem}
      dispatch={dispatch}
    />
  );
}
