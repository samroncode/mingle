import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { logError } from "@/api/log";
import { CatchBoundary } from "@/components/CatchBoundary";
import { Button } from "@/components/ui/button";
import { mirrorScale, TV_HEIGHT, TV_WIDTH } from "@/lib/host/tv-mirror";
import { TvScreen } from "@/views/tv/TvScreen";

/** The TV picture is sized to the box, so it must not bleed past it or fill the viewport. */
const boxStyle = {
  width: TV_WIDTH,
  height: TV_HEIGHT,
  "--tv-bleed": "0px",
  "--tv-min-h": `${TV_HEIGHT}px`,
} as CSSProperties;

/** Follows the width of the element it is attached to. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

interface TvMirrorProps {
  event: EventRow;
  members: MemberRow[];
}

/**
 * A small live copy of the TV. It renders the TV's own screen from the host's
 * event snapshot, laid out at 1920 px and scaled down. Read-only: it cannot be
 * clicked or focused and is hidden from screen readers. It never joins as a TV.
 */
export function TvMirror({ event, members }: TvMirrorProps) {
  const { t } = useTranslation();
  const { ref, width } = useWidth();
  const scale = mirrorScale(width);
  return (
    <div
      ref={ref}
      data-testid="tv-mirror"
      className="relative aspect-video w-full overflow-hidden border-[length:var(--border-thin)] border-edge bg-surface"
    >
      <CatchBoundary
        onError={() =>
          void logError({
            area: "host",
            action: "tv_mirror",
            code: "render_failed",
          })
        }
        fallback={(retry) => (
          <div
            data-testid="tv-mirror-failed"
            className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-ink-muted"
          >
            <p>{t("hostPanel.mirror.unavailable")}</p>
            <Button size="sm" variant="outline" onClick={retry}>
              {t("hostPanel.mirror.retry")}
            </Button>
          </div>
        )}
      >
        <div
          aria-hidden="true"
          inert
          className="pointer-events-none absolute top-0 left-0 origin-top-left select-none"
          style={{ ...boxStyle, transform: `scale(${scale})` }}
        >
          <TvScreen event={event} members={members} themeRoot={false} />
        </div>
      </CatchBoundary>
    </div>
  );
}
