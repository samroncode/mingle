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
  /** Start as a quiet text link instead of the primary button. */
  quietStart?: boolean;
}

/**
 * Start, the one button that does the next thing, and Stop (a quiet link
 * while there is a next move; the primary button once nothing is left): the buttons every
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
  quietStart = false,
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
              size={next ? "default" : "lg"}
              variant={next ? "link" : "default"}
              className={
                next ? "text-current underline shadow-none!" : undefined
              }
              disabled={busy}
              onClick={() => send({ type: "stop_module" })}
            >
              {t(stopLabelKey)}
            </Button>
          </>
        ) : (
          <Button
            size={quietStart ? "default" : "lg"}
            variant={quietStart ? "link" : "default"}
            className={quietStart ? "shadow-none!" : undefined}
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
