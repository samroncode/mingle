import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listMyMatches, subscribeToMatchChanges } from "@/api/competitions";
import { useLoad } from "@/hooks/useLoad";
import type { ModuleGuestViewProps } from "../../types";
import { useCompetitions } from "../useCompetitions";
import { MyMatches } from "./MyMatches";
import { ReportMatch, type Opponent } from "./ReportMatch";

/**
 * "Report a match" for a guest, with their own matches below. Shows nothing
 * until the event has a competition to report.
 */
export function GuestMatches({ event, members, userId }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const { competitions } = useCompetitions(event.id);
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => subscribeToMatchChanges(event.id, reload), [event.id]);
  const matches = useLoad(
    `${event.id}:${userId}`,
    () => listMyMatches(event.id, userId),
    { refresh: changes, keepOnError: true },
  );

  if (
    !event.enabled_modules.includes("competitions") ||
    competitions.status !== "ready" ||
    competitions.value.length === 0
  ) {
    return null;
  }
  const guests = members.filter(
    (member) => member.role === "guest" && member.display_name,
  );
  const names = new Map(
    guests.map((member) => [member.user_id, member.display_name ?? ""]),
  );
  const opponents: Opponent[] = guests
    .filter((member) => member.user_id !== userId)
    .map((member) => ({ id: member.user_id, name: member.display_name ?? "" }));

  return (
    <section data-testid="guest-matches" className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">
        {t("modules.competitions.guest.title")}
      </h2>
      <ReportMatch
        eventId={event.id}
        userId={userId}
        competitions={competitions.value}
        opponents={opponents}
        onReported={reload}
      />
      <MyMatches
        userId={userId}
        matches={matches}
        competitions={competitions.value}
        names={names}
        onRetry={reload}
      />
    </section>
  );
}
