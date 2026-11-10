import { useEffect, useRef, useState } from "react";
import type { WheelEntryView, WheelSpinView } from "@/api/wheel";
import type { LoadState } from "@/hooks/useLoad";
import {
  finalRotation,
  randomOffset,
  spinDurationMs,
} from "@/lib/wheel/geometry";
import { partyMomentMs } from "../../usePartyMoment";

/** Lets the wheel draw at its start position before the spin begins. */
const startDelayMs = 50;

interface View {
  /** The spin the wheel has handled; its result shows once `revealed`. */
  spinId: string | null;
  /**
   * The entries as they were when the spin began. A drawn entry that was taken
   * off in the same step must stay on the wheel until the wheel has stopped.
   */
  frozen: WheelEntryView[] | null;
  rotation: number;
  durationMs: number;
  revealed: boolean;
  /** The entries `rotation` was made for; a different wheel starts over. */
  listKey: string;
}

const idle: View = {
  spinId: null,
  frozen: null,
  rotation: 0,
  durationMs: 0,
  revealed: false,
  listKey: "",
};

const keyOf = (list: WheelEntryView[]) => list.map((e) => e.id).join(",");
const onWheel = (list: WheelEntryView[]) =>
  list.filter((e) => e.state === "on");

/** What the TV draws and shows for the wheel. */
export interface WheelRun {
  /** The entries to draw as wedges. */
  wheel: WheelEntryView[];
  rotation: number;
  durationMs: number;
  /** True from the start of a spin until its result shows. */
  spinning: boolean;
  /** The spin whose result shows; undefined before the first reveal. */
  result?: WheelSpinView;
}

/**
 * Turns the latest spin into an animation. A spin that arrives while the TV is
 * open animates once (about six seconds, slowing down) and shows its winner
 * when that time has passed. A spin that is older than that when the TV loads,
 * or any spin under reduced motion, shows its result straight away.
 */
export function useWheelRun(
  spinState: LoadState<WheelSpinView | null>,
  entriesState: LoadState<WheelEntryView[]>,
  reducedMotion: boolean,
): WheelRun {
  const [view, setView] = useState<View>(idle);
  const viewRef = useRef(view);
  const handled = useRef<string | null | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const entriesRef = useRef<WheelEntryView[]>([]);

  const spin = spinState.status === "ready" ? spinState.value : undefined;
  const all = entriesState.status === "ready" ? entriesState.value : undefined;

  useEffect(() => {
    viewRef.current = view;
    if (all) entriesRef.current = all;
  });
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      // A remount (React strict mode too) starts over from the latest spin.
      handled.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (spin === undefined || all === undefined) return;
    const id = spin?.id ?? null;
    if (handled.current === id) return;
    const first = handled.current === undefined;
    handled.current = id;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // Starting from a timer keeps the state change out of the effect body.
    const apply = () => {
      if (!spin) {
        setView(idle);
        return;
      }

      const now = onWheel(all);
      const frozen = all.filter(
        (e) => e.state === "on" || e.id === spin.entryId,
      );
      const index = frozen.findIndex((e) => e.id === spin.entryId);
      const since = Date.now() - Date.parse(spin.spunAt);
      const age = first && Number.isFinite(since) ? Math.max(0, since) : 0;
      const remaining = spinDurationMs - age;

      if (reducedMotion || index < 0 || remaining <= 0) {
        // Show the result at once, with the pointer on the winner if it is still there.
        const at = now.findIndex((e) => e.id === spin.entryId);
        setView({
          spinId: id,
          frozen: null,
          rotation:
            at < 0
              ? 0
              : finalRotation({ count: now.length, winnerIndex: at, turns: 0 }),
          durationMs: 0,
          revealed: true,
          listKey: keyOf(now),
        });
        return;
      }

      const listKey = keyOf(frozen);
      const before = viewRef.current;
      const start = before.listKey === listKey ? before.rotation : 0;
      const end = finalRotation({
        count: frozen.length,
        winnerIndex: index,
        currentRotation: start,
        offset: randomOffset(),
      });
      setView({
        spinId: id,
        frozen,
        rotation: start,
        durationMs: 0,
        revealed: false,
        listKey,
      });
      const later = (fn: () => void, ms: number) =>
        timers.current.push(setTimeout(fn, ms));
      later(
        () => setView((v) => ({ ...v, rotation: end, durationMs: remaining })),
        startDelayMs,
      );
      later(
        () => setView((v) => ({ ...v, revealed: true })),
        startDelayMs + remaining,
      );
      // After the celebration the wheel follows the entries again.
      later(
        () => {
          const current = onWheel(entriesRef.current);
          setView((v) => {
            const same = keyOf(current) === v.listKey;
            return {
              ...v,
              frozen: null,
              rotation: same ? v.rotation : 0,
              durationMs: 0,
              listKey: keyOf(current),
            };
          });
        },
        startDelayMs + remaining + partyMomentMs,
      );
    };
    timers.current.push(setTimeout(apply, 0));
  }, [spin, all, reducedMotion]);

  const wheel = view.frozen ?? onWheel(all ?? []);
  return {
    wheel,
    rotation: view.rotation,
    durationMs: view.durationMs,
    spinning: view.spinId !== null && !view.revealed,
    result: view.revealed && spin?.id === view.spinId ? spin : undefined,
  };
}
