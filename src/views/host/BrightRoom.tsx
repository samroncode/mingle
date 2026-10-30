import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { setBrightRoom } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useHostAction } from "@/hooks/useHostAction";

interface BrightRoomProps {
  event: EventRow;
  hostKey: string;
}

/**
 * One switch: show the TV and the guests' phones in the light theme, for a
 * bright room. The screens follow the event row, so nothing else changes here.
 */
export function BrightRoom({ event, hostKey }: BrightRoomProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();

  function change(bright: boolean) {
    return run(() => setBrightRoom({ code: event.code, key: hostKey, bright }));
  }

  return (
    <div className="space-y-2" data-testid="bright-room">
      {error && <ErrorLine>{error}</ErrorLine>}
      <Card className="flex-row items-center justify-between">
        <div>
          <CardTitle id="bright-room-label">
            {t("hostPanel.brightRoom.title")}
          </CardTitle>
          <CardDescription>{t("hostPanel.brightRoom.help")}</CardDescription>
        </div>
        <Switch
          aria-labelledby="bright-room-label"
          checked={event.bright_room}
          disabled={busy}
          onCheckedChange={(bright) => void change(bright)}
        />
      </Card>
    </div>
  );
}
