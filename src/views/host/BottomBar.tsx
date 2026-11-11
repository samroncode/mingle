import type { EventRow, MemberRow } from "@/api/events";
import { hasLive } from "./hasLive";
import { RunningLive } from "./RunningLive";

interface BottomBarProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
}

/**
 * Phone only: the running activity's main buttons, pinned to the bottom above
 * the view tabs. Not rendered when nothing runs. Errors from a button show
 * inside the bar, right above the buttons.
 */
export function BottomBar({ event, members, hostKey }: BottomBarProps) {
  if (!hasLive(event) || event.status === "ended") return null;
  return (
    <div
      data-testid="host-bottom-bar"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t-[length:var(--border-chunky)] border-edge bg-surface px-4 py-3 empty:hidden [&_button]:min-h-12 [&_button]:flex-1"
    >
      <RunningLive
        event={event}
        members={members}
        code={event.code}
        hostKey={hostKey}
        startDisabled={false}
        part="actions"
      />
    </div>
  );
}
