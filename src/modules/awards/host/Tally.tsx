import { useTranslation } from "react-i18next";
import type { AwardCategoryView } from "@/api/awards";
import type { MemberRow } from "@/api/events";
import { useAwardTally } from "../useAwardResults";

interface TallyProps {
  category: AwardCategoryView;
  members: MemberRow[];
  language: string;
  version: number;
}

/** The full count per guest on a revealed category, so the host can read out runners-up. */
export function Tally({ category, members, language, version }: TallyProps) {
  const { t } = useTranslation();
  const tally = useAwardTally(category.id, true, version);
  if (tally.status !== "ready") return null;
  const rows = tally.value
    .map((row) => ({
      name: members.find((m) => m.user_id === row.userId)?.display_name,
      votes: row.votes,
    }))
    .filter((row): row is { name: string; votes: number } => !!row.name)
    .sort(
      (a, b) => b.votes - a.votes || a.name.localeCompare(b.name, language),
    );

  return (
    <div data-testid="awards-tally" className="space-y-1">
      <p className="text-sm font-medium">
        {t("modules.awards.host.tally.title")}
      </p>
      <ul className="text-sm">
        {rows.map((row) => (
          <li key={row.name} className="flex justify-between gap-4">
            <span>{row.name}</span>
            <span>
              {t("modules.awards.host.tally.votes", { count: row.votes })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
