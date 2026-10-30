import { useTranslation } from "react-i18next";
import { Card, CardTitle } from "@/components/ui/card";
import type { NoticeView } from "@/api/notices";

/** When a notice was sent, as a short local time. */
function sentAt(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Every message the host has sent, newest first. Plain text only. */
export function NoticeList({ notices }: { notices: readonly NoticeView[] }) {
  const { t, i18n } = useTranslation();
  if (notices.length === 0) return null;
  return (
    <Card data-testid="notice-list">
      <CardTitle className="text-2xl">{t("guest.notices.title")}</CardTitle>
      <ul className="space-y-3">
        {notices.map((notice) => (
          <li key={notice.id} className="space-y-0.5">
            <time
              dateTime={notice.createdAt}
              className="text-sm text-on-paper-muted"
            >
              {sentAt(notice.createdAt, i18n.language)}
            </time>
            <p className="text-lg leading-snug break-words whitespace-pre-line">
              {notice.text}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
