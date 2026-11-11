import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { Button } from "@/components/ui/button";
import { currentProgramIndex } from "@/lib/host/next-program";
import { readParty } from "@/lib/party";
import { anyLineHasTime, formatScheduleLine } from "@/lib/schedule";
import { PartyEditor } from "../PartyScreen";
import { EditFold } from "./EditFold";

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * The evening's program as a simple list. When the lines have times, the one
 * that is on now is marked. Edit opens the party screen editor in place.
 */
export function ProgramBlock({
  event,
  hostKey,
}: {
  event: EventRow;
  hostKey: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const lines = readParty(event.party).schedule ?? [];
  const current = anyLineHasTime(lines)
    ? currentProgramIndex(lines, minutesNow())
    : -1;
  return (
    <div className="space-y-2">
      {lines.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t("hostPanel.dashboard.programEmpty")}
        </p>
      ) : (
        <ol
          data-testid="program-list"
          className="divide-y-[length:var(--border-thin)] divide-line"
        >
          {lines.map((line, index) => (
            <li
              key={`${index}-${line.title}`}
              aria-current={index === current ? "step" : undefined}
              className="flex items-baseline gap-2 py-1.5"
            >
              <span
                className={
                  index === current
                    ? "font-display font-bold text-sage-text"
                    : "text-ink"
                }
              >
                {formatScheduleLine(line)}
              </span>
              {index === current && (
                <span className="text-sm text-sage-text">
                  {t("hostPanel.dashboard.programNow")}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <Button
        size="sm"
        variant="outline"
        aria-expanded={editing}
        onClick={() => setEditing((open) => !open)}
      >
        {t(
          editing
            ? "hostPanel.dashboard.close"
            : "hostPanel.dashboard.programEdit",
        )}
      </Button>
      {editing && (
        <EditFold label={t("hostPanel.dashboard.programEdit")}>
          <PartyEditor
            event={event}
            hostKey={hostKey}
            onDone={() => setEditing(false)}
          />
        </EditFold>
      )}
    </div>
  );
}
