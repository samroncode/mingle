import { ErrorLine } from "@/components/ErrorLine";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { setFlow } from "@/api/host-actions";
import type { FlowMove } from "@/lib/schemas/host-actions";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import type { ModuleId } from "./registry";

/** The move the one "next" button sends, with the label it shows. */
export interface NextMove {
  move: "open" | "reveal" | "next_step";
  labelKey: ParseKeys;
}

interface RunControlsProps {
  code: string;
  hostKey: string;
  module: ModuleId;
  /** This activity is the one on the TV now. */
  running: boolean;
  /** True while another activity runs, or this one can't start. */
  startDisabled: boolean;
  /** i18n key of the Start button's label. */
  startLabelKey: ParseKeys;
  /** The activity's next move, or null when there is none left. */
  next: NextMove | null;
  /** i18n key of the Stop button's label; "Stop" unless given. */
  stopLabelKey?: ParseKeys;
}

/**
 * Start, the one button that does the next thing, and Stop: the buttons every
 * activity's control panel section shares. Shows its own error line.
 */
export function RunControls({
  code,
  hostKey,
  module,
  running,
  startDisabled,
  startLabelKey,
  next,
  stopLabelKey = "hostPanel.stop",
}: RunControlsProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();

  function send(move: FlowMove) {
    void run(() => setFlow({ code, key: hostKey, move }));
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {running ? (
          <>
            {next && (
              <Button
                size="lg"
                disabled={busy}
                onClick={() => send({ type: next.move })}
              >
                {t(next.labelKey)}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => send({ type: "stop_module" })}
            >
              {t(stopLabelKey)}
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            disabled={busy || startDisabled}
            onClick={() => send({ type: "start_module", module })}
          >
            {t(startLabelKey)}
          </Button>
        )}
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}
