import { Megaphone, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Banner } from "@/lib/guest/notices";

interface NoticeBannerProps {
  banner: Banner;
  onDismiss: (id: string) => void;
}

/**
 * The host's newest message, at the top of the page in normal flow: it never
 * covers the answers or opens by itself, and makes no sound. The text is
 * rendered as plain text.
 */
export function NoticeBanner({ banner, onDismiss }: NoticeBannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      data-testid="notice-banner"
      className="flex items-center gap-3 rounded-lg border-[length:var(--border-thin)] border-edge bg-champagne-soft-fill p-3 text-on-bright"
    >
      <Megaphone aria-hidden className="size-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-snug break-words whitespace-pre-line">
          {banner.notice.text}
        </p>
        {banner.more > 0 && (
          <p className="text-sm font-bold">
            {t("guest.notices.more", { count: banner.more })}
          </p>
        )}
      </div>
      <Button
        size="icon"
        variant="secondary"
        aria-label={t("guest.notices.dismiss")}
        onClick={() => onDismiss(banner.notice.id)}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
