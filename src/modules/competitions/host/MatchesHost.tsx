import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CompetitionView, HostMatchView } from "@/api/competitions";
import { updateMatch } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import { matchErrorKey } from "@/lib/host/competitions-errors";
import { checkMatchEdit, type MatchEditForm } from "@/lib/host/match-edit";
import type { MatchChange } from "@/lib/schemas/host-actions";
import type { ModuleHostProps } from "../../types";
import { useEventMatches } from "../useEventMatches";

interface MatchesHostProps extends Pick<ModuleHostProps, "event" | "members"> {
  code: string;
  hostKey: string;
  competitions: CompetitionView[];
}

/** The reported matches of the event, newest first, for the host to fix or delete. */
export function MatchesHost({
  event,
  members,
  code,
  hostKey,
  competitions,
}: MatchesHostProps) {
  const { t } = useTranslation();
  const { matches, reload } = useEventMatches(event.id);
  const { busy, error, run } = useHostAction(matchErrorKey, "host");
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState<MatchEditForm>();
  const [deleting, setDeleting] = useState<string>();

  const ended = event.status === "ended";
  const list = matches.status === "ready" ? matches.value : [];
  const names = new Map(
    members.map((m) => [m.user_id, m.display_name ?? ""] as const),
  );
  const nameOf = (id: string) =>
    names.get(id) || t("modules.competitions.host.matches.someone");
  const check = editing && form ? checkMatchEdit(editing, form) : undefined;
  const problem = check && !check.ok ? check.problem : undefined;

  /** Sends one fix; true when it was saved. */
  async function change(body: MatchChange): Promise<boolean> {
    const result = await run(
      () => updateMatch({ code, key: hostKey, change: body }),
      `match_${body.type}`,
    );
    // A match that is gone already should leave the list too.
    if (result.ok || result.error === "not_found") reload();
    return result.ok;
  }

  function startEdit(match: HostMatchView) {
    setDeleting(undefined);
    setEditing(match.id);
    setForm({
      winnerId: match.winnerId,
      winnerScore: match.winnerScore?.toString() ?? "",
      loserScore: match.loserScore?.toString() ?? "",
    });
  }

  /** The scores stay in the winner and loser fields: they go to whoever now won. */
  function pickWinner(winnerId: string) {
    setForm((current) => current && { ...current, winnerId });
  }

  async function save() {
    if (!check?.ok) return;
    if (await change(check.change)) {
      setEditing(undefined);
      setForm(undefined);
    }
  }

  async function remove(id: string) {
    if (await change({ type: "delete", id })) setDeleting(undefined);
  }

  function editor(match: HostMatchView, current: MatchEditForm) {
    const players = [match.winnerId, match.loserId];
    const otherId = players.find((id) => id !== current.winnerId) ?? "";
    return (
      <form
        className="space-y-3"
        onSubmit={(submit) => {
          submit.preventDefault();
          void save();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="font-bold">
            {t("modules.competitions.host.matches.editTitle")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {players.map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={current.winnerId === id ? "default" : "outline"}
                aria-pressed={current.winnerId === id}
                onClick={() => pickWinner(id)}
              >
                {nameOf(id)}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm font-bold">
            {t("modules.competitions.host.matches.winnerScore", {
              name: nameOf(current.winnerId),
            })}
            <Input
              inputMode="numeric"
              maxLength={3}
              value={current.winnerScore}
              aria-invalid={problem !== undefined}
              onChange={(e) =>
                setForm({ ...current, winnerScore: e.target.value })
              }
            />
          </label>
          <label className="space-y-1 text-sm font-bold">
            {t("modules.competitions.host.matches.loserScore", {
              name: nameOf(otherId),
            })}
            <Input
              inputMode="numeric"
              maxLength={3}
              value={current.loserScore}
              aria-invalid={problem !== undefined}
              onChange={(e) =>
                setForm({ ...current, loserScore: e.target.value })
              }
            />
          </label>
        </div>
        <p className="text-sm text-ink-muted">
          {t("modules.competitions.host.matches.scoreHint")}
        </p>
        {problem && (
          <ErrorLine>
            {t(`modules.competitions.host.matches.errors.${problem}`)}
          </ErrorLine>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy || !check?.ok}>
            {t("modules.competitions.host.matches.save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setEditing(undefined);
              setForm(undefined);
            }}
          >
            {t("modules.competitions.host.matches.cancel")}
          </Button>
        </div>
      </form>
    );
  }

  function row(match: HostMatchView) {
    const winner = nameOf(match.winnerId);
    const loser = nameOf(match.loserId);
    const competition =
      competitions.find((c) => c.id === match.competitionId)?.name ?? "";
    if (editing === match.id && form) return editor(match, form);
    if (deleting === match.id) {
      return (
        <div
          role="alertdialog"
          aria-label={t("modules.competitions.host.matches.deleteAction")}
          className="space-y-3"
        >
          <p>
            {t("modules.competitions.host.matches.deleteConfirm", {
              winner,
              loser,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove(match.id)}
            >
              {t("modules.competitions.host.matches.deleteAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
            >
              {t("modules.competitions.host.matches.cancel")}
            </Button>
          </div>
        </div>
      );
    }
    const hasScore = match.winnerScore !== null && match.loserScore !== null;
    return (
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <p className="break-words font-display font-bold">{competition}</p>
          <p className="break-words">
            {t("modules.competitions.host.matches.line", { winner, loser })}
            {hasScore && (
              <span className="ml-2 font-display font-bold">
                {t("modules.competitions.host.matches.score", {
                  winner: match.winnerScore,
                  loser: match.loserScore,
                })}
              </span>
            )}
          </p>
          <p className="text-sm text-ink-muted">
            {t("modules.competitions.host.matches.reportedBy", {
              name: nameOf(match.reporterId),
            })}
          </p>
        </div>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended}
          aria-label={t("modules.competitions.host.matches.edit", {
            competition,
            winner,
            loser,
          })}
          onClick={() => startEdit(match)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended}
          aria-label={t("modules.competitions.host.matches.delete", {
            competition,
            winner,
            loser,
          })}
          onClick={() => {
            setEditing(undefined);
            setForm(undefined);
            setDeleting(match.id);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <section
      data-testid="competitions-matches"
      aria-label={t("modules.competitions.host.matches.title")}
      className="space-y-3"
    >
      <h3 className="font-display text-lg font-bold">
        {t("modules.competitions.host.matches.title")}
      </h3>
      {matches.status === "error" && (
        <div className="space-y-2">
          <ErrorLine>
            {t("modules.competitions.host.matches.loadFailed")}
          </ErrorLine>
          <Button size="sm" variant="outline" onClick={reload}>
            {t("modules.competitions.host.matches.retry")}
          </Button>
        </div>
      )}
      {matches.status === "ready" && list.length === 0 && (
        <p className="text-sm text-ink-muted">
          {t("modules.competitions.host.matches.empty")}
        </p>
      )}
      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((match) => (
            <li key={match.id}>
              <Card className="p-3">{row(match)}</Card>
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </section>
  );
}
