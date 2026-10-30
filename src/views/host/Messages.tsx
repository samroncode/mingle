import { Megaphone } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteNotice, listNotices, sendNotice } from "@/api/notices";
import { ErrorLine } from "@/components/ErrorLine";
import { PanelSection } from "@/components/PanelSection";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHostAction } from "@/hooks/useHostAction";
import { useLoad } from "@/hooks/useLoad";
import {
  canSendNotice,
  charactersLeft,
  formatSentTime,
} from "@/lib/host/notices";

interface MessagesProps {
  eventId: string;
  code: string;
  hostKey: string;
  language: string;
  /** The event's `notices_version`; it changes on every send and delete. */
  noticesVersion: number;
}

function SendForm({
  code,
  hostKey,
  onSent,
}: {
  code: string;
  hostKey: string;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const { busy, error, run } = useHostAction();
  // A double tap lands before `busy` renders, so the first tap takes the lock.
  const sending = useRef(false);
  const left = charactersLeft(text);

  async function send() {
    if (sending.current || !canSendNotice(text)) return;
    sending.current = true;
    try {
      const result = await run(() => sendNotice({ code, key: hostKey, text }));
      if (result.ok) {
        setText("");
        onSent();
      }
    } finally {
      sending.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        aria-label={t("hostPanel.messages.label")}
        placeholder={t("hostPanel.messages.placeholder")}
        value={text}
        rows={3}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p
          className={
            left < 0
              ? "text-sm text-danger-text"
              : "text-sm text-on-paper-muted"
          }
          aria-live="polite"
        >
          {t("hostPanel.messages.left", { count: left })}
        </p>
        <Button
          size="sm"
          disabled={busy || !canSendNotice(text)}
          onClick={() => void send()}
        >
          <Megaphone aria-hidden />
          {t("hostPanel.messages.send")}
        </Button>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

function DeleteButton({
  code,
  hostKey,
  id,
  onDone,
}: {
  code: string;
  hostKey: string;
  id: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();
  async function remove() {
    const result = await run(() => deleteNotice({ code, key: hostKey, id }));
    // A notice that is already gone is gone: read the list again either way.
    if (result.ok || result.error === "not_found") onDone();
  }
  return (
    <div className="shrink-0 space-y-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void remove()}
      >
        {t("hostPanel.messages.delete")}
      </Button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

/**
 * The host's messages to the guests' phones, closed to start with: write a
 * short text and send it, and see or delete the ones already sent.
 */
export function Messages({
  eventId,
  code,
  hostKey,
  language,
  noticesVersion,
}: MessagesProps) {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  const load = useLoad(`notices:${eventId}`, () => listNotices(eventId), {
    refresh: refresh + noticesVersion,
    keepOnError: true,
  });
  const notices = load.status === "ready" ? load.value : undefined;
  const again = () => setRefresh((count) => count + 1);

  const summary = notices
    ? notices.length === 0
      ? t("hostPanel.messages.none")
      : t("hostPanel.messages.sent", { count: notices.length })
    : undefined;

  return (
    <PanelSection
      testId="host-messages"
      title={t("hostPanel.messages.title")}
      summary={summary}
    >
      <SendForm code={code} hostKey={hostKey} onSent={again} />
      {load.status === "error" && (
        <ErrorLine>{t("hostPanel.messages.loadFailed")}</ErrorLine>
      )}
      {load.status === "loading" && (
        <p className="text-on-paper-muted">{t("hostPanel.loading")}</p>
      )}
      {notices && notices.length > 0 && (
        <ul className="space-y-2" aria-label={t("hostPanel.messages.history")}>
          {notices.map((notice) => (
            <li
              key={notice.id}
              className="flex items-start justify-between gap-3 rounded-md border-[length:var(--border-thin)] border-edge p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-on-paper-muted">
                  {formatSentTime(notice.createdAt, language)}
                </p>
                <p className="break-words">{notice.text}</p>
              </div>
              <DeleteButton
                code={code}
                hostKey={hostKey}
                id={notice.id}
                onDone={again}
              />
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
