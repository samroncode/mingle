import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CompetitionView } from "@/api/competitions";
import { updateCompetitions } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import { competitionErrorKey } from "@/lib/host/competitions-errors";
import {
  CompetitionNameSchema,
  competitionsLimits,
} from "@/lib/schemas/competitions";
import type { ModuleHostProps } from "../../types";
import { useCompetitions } from "../useCompetitions";
import { MatchesHost } from "./MatchesHost";
import { Spotlight } from "./Spotlight";

/** The competitions section of the control panel: list, add, rename, remove, reorder. */
export function CompetitionsHost({
  event,
  members,
  code,
  hostKey,
  startDisabled,
}: ModuleHostProps) {
  const { t } = useTranslation();
  const { competitions, reload } = useCompetitions(event.id);
  const { busy, error, run } = useHostAction(competitionErrorKey, "host");
  const [draftName, setDraftName] = useState("");
  const [renaming, setRenaming] = useState<string>();
  const [renameText, setRenameText] = useState("");
  const [removing, setRemoving] = useState<string>();

  const list = competitions.status === "ready" ? competitions.value : [];
  const ended = event.status === "ended";
  const full = list.length >= competitionsLimits.perEvent;
  const addName = CompetitionNameSchema.safeParse(draftName);

  /** Sends one change; true when it was saved. */
  async function change(
    body: Parameters<typeof updateCompetitions>[0]["change"],
  ): Promise<boolean> {
    const result = await run(
      () => updateCompetitions({ code, key: hostKey, change: body }),
      `competition_${body.type}`,
    );
    if (result.ok) reload();
    return result.ok;
  }

  async function add(submit: FormEvent) {
    submit.preventDefault();
    if (!addName.success) return;
    if (await change({ type: "add", name: addName.data })) setDraftName("");
  }

  async function rename(id: string) {
    const name = CompetitionNameSchema.safeParse(renameText);
    if (!name.success) return;
    if (await change({ type: "rename", id, name: name.data })) {
      setRenaming(undefined);
    }
  }

  async function remove(id: string) {
    if (await change({ type: "remove", id })) setRemoving(undefined);
  }

  function move(index: number, offset: number) {
    const ids = list.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + offset, 0, moved);
    void change({ type: "reorder", ids });
  }

  function row(competition: CompetitionView, index: number) {
    const { id, name } = competition;
    if (renaming === id) {
      return (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(submit) => {
            submit.preventDefault();
            void rename(id);
          }}
        >
          <Input
            className="min-w-0 flex-1"
            value={renameText}
            maxLength={competitionsLimits.name}
            aria-label={t("modules.competitions.host.renameLabel", { name })}
            onChange={(e) => setRenameText(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            disabled={
              busy || !CompetitionNameSchema.safeParse(renameText).success
            }
          >
            {t("modules.competitions.host.save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setRenaming(undefined)}
          >
            {t("modules.competitions.host.cancel")}
          </Button>
        </form>
      );
    }
    if (removing === id) {
      return (
        <div
          role="alertdialog"
          aria-label={t("modules.competitions.host.removeTitle", { name })}
          className="space-y-3"
        >
          <p>{t("modules.competitions.host.removeConfirm", { name })}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove(id)}
            >
              {t("modules.competitions.host.removeAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(undefined)}
            >
              {t("modules.competitions.host.cancel")}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 break-words font-display font-bold">
          {name}
        </p>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended || index === 0}
          aria-label={t("modules.competitions.host.moveUp", { name })}
          onClick={() => move(index, -1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended || index === list.length - 1}
          aria-label={t("modules.competitions.host.moveDown", { name })}
          onClick={() => move(index, 1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended}
          aria-label={t("modules.competitions.host.rename", { name })}
          onClick={() => {
            setRemoving(undefined);
            setRenaming(id);
            setRenameText(name);
          }}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          disabled={busy || ended}
          aria-label={t("modules.competitions.host.remove", { name })}
          onClick={() => {
            setRenaming(undefined);
            setRemoving(id);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <section
      data-testid="competitions-host"
      aria-label={t("modules.competitions.name")}
      className="space-y-3"
    >
      {competitions.status === "error" && (
        <ErrorLine>{t("modules.competitions.host.loadFailed")}</ErrorLine>
      )}
      {competitions.status === "ready" && list.length === 0 && (
        <p className="text-sm text-ink-muted">
          {t("modules.competitions.host.empty")}
        </p>
      )}
      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((competition, index) => (
            <li key={competition.id}>
              <Card className="p-3">{row(competition, index)}</Card>
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      {!ended &&
        (full ? (
          <p className="text-sm text-ink-muted">
            {t("modules.competitions.host.full", {
              max: competitionsLimits.perEvent,
            })}
          </p>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(submit) => void add(submit)}
          >
            <Input
              className="min-w-0 flex-1"
              value={draftName}
              maxLength={competitionsLimits.name}
              aria-label={t("modules.competitions.host.newName")}
              placeholder={t("modules.competitions.host.newPlaceholder")}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <Button type="submit" disabled={busy || !addName.success}>
              {t("modules.competitions.host.add")}
            </Button>
          </form>
        ))}
      {list.length > 0 && (
        <Spotlight
          event={event}
          code={code}
          hostKey={hostKey}
          startDisabled={startDisabled}
          competitions={list}
        />
      )}
      {list.length > 0 && (
        <MatchesHost
          event={event}
          members={members}
          code={code}
          hostKey={hostKey}
          competitions={list}
        />
      )}
    </section>
  );
}
