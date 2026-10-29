import { useTranslation } from "react-i18next";
import type { AwardCategoryView } from "@/api/awards";
import type { MemberRow } from "@/api/events";
import { useAwardVoters } from "../useAwardVoters";

interface VoteStatusProps {
  category: AwardCategoryView;
  members: MemberRow[];
  version: number;
}

/** "7 of 12 voted", and who has voted by name, never for whom. */
export function VoteStatus({ category, members, version }: VoteStatusProps) {
  const { t } = useTranslation();
  const voters = new Set(useAwardVoters(category.id, version));
  const guests = members.filter((m) => m.role === "guest");
  const names = guests
    .filter((m) => voters.has(m.user_id))
    .map((m) => m.display_name);

  return (
    <div data-testid="awards-voted" className="space-y-1">
      <p className="text-sm font-medium">
        {t("modules.awards.voted", {
          count: category.voteCount,
          total: guests.length,
        })}
      </p>
      {names.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {names.map((name) => (
            <li key={name} className="rounded-full border px-2 py-0.5">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
