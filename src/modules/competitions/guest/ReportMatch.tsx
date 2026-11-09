import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  reportMatch,
  type CompetitionView,
  type ReportMatchErrorCode,
} from "@/api/competitions";
import { logError } from "@/api/log";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkMatchForm, emptyMatchForm, type MatchForm } from "./matchForm";
import { PickTile } from "./PickTile";

export interface Opponent {
  id: string;
  name: string;
}

interface ReportMatchProps {
  eventId: string;
  userId: string;
  competitions: CompetitionView[];
  /** The other guests of the event. */
  opponents: Opponent[];
  /** Called once the database has stored the match. */
  onReported: () => void;
}

/**
 * The guest reports a match: competition, opponent, "I won" / "I lost" and an
 * optional score. A failed report keeps everything that was entered and shows
 * why in plain words; only a code goes to the log, never a name or a score.
 */
export function ReportMatch({
  eventId,
  userId,
  competitions,
  opponents,
  onReported,
}: ReportMatchProps) {
  const { t } = useTranslation();
  // One competition needs no question.
  const [form, setForm] = useState<MatchForm>({
    ...emptyMatchForm,
    competitionId: competitions.length === 1 ? competitions[0]?.id : undefined,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ReportMatchErrorCode>();
  const [reported, setReported] = useState(false);

  const check = checkMatchForm(eventId, userId, form);
  const problem =
    check.ok || check.problem === "incomplete" ? undefined : check.problem;

  function change(next: Partial<MatchForm>) {
    setForm((current) => ({ ...current, ...next }));
    setError(undefined);
  }

  async function send() {
    if (!check.ok || sending) return;
    setSending(true);
    setError(undefined);
    const result = await reportMatch(check.report);
    setSending(false);
    if (result.ok) {
      setReported(true);
      setForm({
        ...emptyMatchForm,
        competitionId: form.competitionId,
      });
      onReported();
      return;
    }
    setError(result.error);
    void logError({
      area: "competitions",
      action: "report_match",
      code: result.error,
    });
  }

  if (opponents.length === 0) {
    return (
      <p data-testid="match-no-opponents" className="text-lg text-ink-muted">
        {t("modules.competitions.guest.noOpponents")}
      </p>
    );
  }

  if (reported) {
    return (
      <div data-testid="match-reported" className="space-y-4">
        <p className="fun-pop font-display text-2xl font-extrabold text-champagne-text">
          {t("modules.competitions.guest.reported")}
        </p>
        <Button size="lg" onClick={() => setReported(false)}>
          {t("modules.competitions.guest.another")}
        </Button>
      </div>
    );
  }

  const scoreFields = [
    { key: "mine", label: t("modules.competitions.guest.myScore") },
    { key: "theirs", label: t("modules.competitions.guest.theirScore") },
  ] as const;

  return (
    <form
      data-testid="match-form"
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {competitions.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="font-display text-lg font-bold">
            {t("modules.competitions.guest.competition")}
          </legend>
          {competitions.map((competition) => (
            <PickTile
              key={competition.id}
              picked={form.competitionId === competition.id}
              onPress={() => change({ competitionId: competition.id })}
            >
              {competition.name}
            </PickTile>
          ))}
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="font-display text-lg font-bold">
          {t("modules.competitions.guest.opponent")}
        </legend>
        {opponents.map((opponent) => (
          <PickTile
            key={opponent.id}
            picked={form.opponentId === opponent.id}
            onPress={() => change({ opponentId: opponent.id })}
          >
            {opponent.name}
          </PickTile>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-display text-lg font-bold">
          {t("modules.competitions.guest.result")}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <PickTile
            fill="sage"
            picked={form.outcome === "won"}
            onPress={() => change({ outcome: "won" })}
          >
            {t("modules.competitions.guest.won")}
          </PickTile>
          <PickTile
            fill="blush"
            picked={form.outcome === "lost"}
            onPress={() => change({ outcome: "lost" })}
          >
            {t("modules.competitions.guest.lost")}
          </PickTile>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-display text-lg font-bold">
          {t("modules.competitions.guest.scoreTitle")}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {scoreFields.map(({ key, label }) => (
            <label key={key} className="space-y-1 text-sm font-bold">
              {label}
              <Input
                inputMode="numeric"
                maxLength={3}
                value={form[key]}
                aria-invalid={problem !== undefined}
                onChange={(event) => change({ [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
        {problem && (
          <ErrorLine>
            {t(`modules.competitions.guest.errors.${problem}`)}
          </ErrorLine>
        )}
      </fieldset>

      {error && (
        <ErrorLine>{t(`modules.competitions.guest.errors.${error}`)}</ErrorLine>
      )}
      <Button type="submit" size="lg" disabled={!check.ok || sending}>
        {sending
          ? t("modules.competitions.guest.sending")
          : t("modules.competitions.guest.submit")}
      </Button>
    </form>
  );
}
