import { Megaphone } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendNotice } from "@/api/notices";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import { canSendNotice, noticeMaxLength } from "@/lib/host/notices";

interface SideMessageProps {
  code: string;
  hostKey: string;
}

/** A one-line message to the guests' phones with a Send button. */
export function SideMessage({ code, hostKey }: SideMessageProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [lastSent, setLastSent] = useState<string>();
  const { busy, error, run } = useHostAction();
  // A double tap lands before `busy` renders, so the first tap takes the lock.
  const sending = useRef(false);

  async function send() {
    if (sending.current || !canSendNotice(text)) return;
    sending.current = true;
    try {
      const result = await run(() => sendNotice({ code, key: hostKey, text }));
      if (result.ok) {
        setLastSent(text.trim());
        setText("");
      }
    } finally {
      sending.current = false;
    }
  }

  return (
    <section
      data-testid="side-message"
      aria-label={t("hostPanel.side.messageTitle")}
      className="space-y-2"
    >
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
        {t("hostPanel.side.messageTitle")}
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          aria-label={t("hostPanel.side.messageLabel")}
          placeholder={t("hostPanel.side.messagePlaceholder")}
          value={text}
          maxLength={noticeMaxLength * 2}
          aria-invalid={!!error}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy || !canSendNotice(text)}>
          <Megaphone aria-hidden />
          {t("hostPanel.side.messageSend")}
        </Button>
      </form>
      {error && <ErrorLine>{error}</ErrorLine>}
      {lastSent && !error && (
        <p
          data-testid="side-message-sent"
          className="break-words text-sm text-ink-muted"
          aria-live="polite"
        >
          {t("hostPanel.side.messageSent", { text: lastSent })}
        </p>
      )}
    </section>
  );
}
