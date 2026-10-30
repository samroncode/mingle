import { Trophy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { updatePartyContent } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { PanelSection } from "@/components/PanelSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import { readParty } from "@/lib/party";
import { partyLimits } from "@/lib/schemas/party";
import {
  saveWinners,
  type WinnerInput,
  type WinnerProblem,
  type WinnersChange,
} from "@/lib/host/winners-edit";

interface WinnersProps {
  event: EventRow;
  hostKey: string;
}

type Save = (change: WinnersChange) => Promise<boolean>;

/** Saves one change at once; true when it went through. */
function useSaveWinners({ event, hostKey }: WinnersProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();
  const [problems, setProblems] = useState<WinnerProblem[]>([]);

  const save: Save = async (change) => {
    const result = await run(() =>
      saveWinners(
        change,
        readParty(event.party),
        { code: event.code, key: hostKey },
        updatePartyContent,
      ),
    );
    setProblems("problems" in result ? result.problems : []);
    return result.ok;
  };
  const problemText = problems.map((p) => t(`hostPanel.winners.errors.${p}`));
  return { busy, error, problems, problemText, save };
}

function WinnerFields({
  value,
  problems,
  onChange,
}: {
  value: WinnerInput;
  problems: WinnerProblem[];
  onChange: (value: WinnerInput) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Input
        aria-label={t("hostPanel.winners.titleLabel")}
        placeholder={t("hostPanel.winners.titlePlaceholder")}
        value={value.title}
        maxLength={partyLimits.winnerText * 2}
        aria-invalid={problems.includes("title")}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <Input
        aria-label={t("hostPanel.winners.nameLabel")}
        placeholder={t("hostPanel.winners.namePlaceholder")}
        value={value.name}
        maxLength={partyLimits.winnerText * 2}
        aria-invalid={problems.includes("name")}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
    </div>
  );
}

function AddWinner(props: WinnersProps) {
  const { t } = useTranslation();
  const [winner, setWinner] = useState<WinnerInput>({ title: "", name: "" });
  const { busy, error, problems, problemText, save } = useSaveWinners(props);

  async function add() {
    if (await save({ kind: "add", winner })) setWinner({ title: "", name: "" });
  }
  return (
    <div className="space-y-2">
      <WinnerFields value={winner} problems={problems} onChange={setWinner} />
      {problemText.map((text) => (
        <ErrorLine key={text}>{text}</ErrorLine>
      ))}
      {error && <ErrorLine>{error}</ErrorLine>}
      <Button size="sm" disabled={busy} onClick={() => void add()}>
        {t("hostPanel.winners.add")}
      </Button>
    </div>
  );
}

function WinnerRow({
  winner,
  index,
  ...props
}: WinnersProps & { winner: WinnerInput; index: number }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<WinnerInput>();
  const { busy, error, problems, problemText, save } = useSaveWinners(props);

  async function saveEdit() {
    if (draft && (await save({ kind: "edit", index, winner: draft }))) {
      setDraft(undefined);
    }
  }

  if (draft) {
    return (
      <li className="space-y-2 rounded-md border-[length:var(--border-thin)] border-edge p-3">
        <WinnerFields value={draft} problems={problems} onChange={setDraft} />
        {problemText.map((text) => (
          <ErrorLine key={text}>{text}</ErrorLine>
        ))}
        {error && <ErrorLine>{error}</ErrorLine>}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void saveEdit()}>
            {t("hostPanel.winners.save")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setDraft(undefined)}
          >
            {t("hostPanel.winners.cancel")}
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li className="space-y-2 rounded-md border-[length:var(--border-thin)] border-edge p-3">
      <div className="min-w-0">
        <p className="text-sm text-on-paper-muted">{winner.title}</p>
        <p className="break-words font-display text-lg font-bold">
          {winner.name}
        </p>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setDraft(winner)}>
          {t("hostPanel.winners.edit")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void save({ kind: "delete", index })}
        >
          {t("hostPanel.winners.delete")}
        </Button>
      </div>
    </li>
  );
}

function HiddenToggle({
  hidden,
  ...props
}: WinnersProps & { hidden: boolean }) {
  const { t } = useTranslation();
  const { busy, error, save } = useSaveWinners(props);
  return (
    <div className="space-y-2">
      <p className="text-sm text-on-paper-muted">
        {t(
          hidden
            ? "hostPanel.winners.hiddenHelp"
            : "hostPanel.winners.shownHelp",
        )}
      </p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => void save({ kind: "hidden", hidden: !hidden })}
      >
        {t(hidden ? "hostPanel.winners.show" : "hostPanel.winners.hide")}
      </Button>
    </div>
  );
}

/**
 * The host's small contests, closed to start with: add, edit or delete a
 * winner and hide the TV slide. Each change saves at once and touches only
 * the winners fields of the party content.
 */
export function Winners(props: WinnersProps) {
  const { t } = useTranslation();
  const party = readParty(props.event.party);
  const winners = party.winners ?? [];
  const hidden = party.winnersHidden ?? false;
  const summary = hidden
    ? t("hostPanel.winners.hidden")
    : winners.length === 0
      ? t("hostPanel.winners.none")
      : t("hostPanel.winners.count", { count: winners.length });

  return (
    <PanelSection
      testId="host-winners"
      title={t("hostPanel.winners.title")}
      summary={summary}
      badge={<Trophy aria-hidden className="size-5" />}
    >
      {winners.length > 0 && (
        <ul className="space-y-2" aria-label={t("hostPanel.winners.list")}>
          {winners.map((winner, index) => (
            <WinnerRow
              key={`${index}:${winner.title}:${winner.name}`}
              winner={winner}
              index={index}
              {...props}
            />
          ))}
        </ul>
      )}
      <AddWinner {...props} />
      {winners.length > 0 && <HiddenToggle hidden={hidden} {...props} />}
    </PanelSection>
  );
}
