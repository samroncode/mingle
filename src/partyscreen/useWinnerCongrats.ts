import { useEffect, useRef, useState } from "react";
import type { Party } from "@/lib/schemas/party";
import { newWinners, type Winner } from "./winners-greeting";

export const CONGRATS_MS = 4000;

interface Congrats extends Winner {
  id: number;
}

/**
 * The winner to congratulate now, or null. New winners are queued and shown
 * one at a time; the winners already there on the first snapshot are not.
 */
export function useWinnerCongrats(party: Party): Congrats | null {
  const previous = useRef<Party | null>(null);
  const nextId = useRef(0);
  const [queue, setQueue] = useState<Congrats[]>([]);

  useEffect(() => {
    const added = newWinners(previous.current, party);
    previous.current = party;
    if (added.length === 0) return;
    setQueue((q) => [
      ...q,
      ...added.map((w) => ({ ...w, id: nextId.current++ })),
    ]);
  }, [party]);

  const current = queue[0] ?? null;
  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), CONGRATS_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  return current;
}
