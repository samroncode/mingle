import { useEffect, useRef, useState } from "react";
import type { MemberRow } from "@/api/events";
import { newGuests } from "./guests";

export const WELCOME_MS = 4000;

interface Welcome {
  id: string;
  name: string;
}

/**
 * The guest to greet now, or null. New guests are queued and shown one at a
 * time; the guests already there on the first snapshot are not greeted.
 */
export function useGuestWelcomes(members: MemberRow[]): Welcome | null {
  const previous = useRef<MemberRow[] | null>(null);
  const [queue, setQueue] = useState<Welcome[]>([]);

  useEffect(() => {
    const arrived = newGuests(previous.current, members);
    previous.current = members;
    if (arrived.length === 0) return;
    setQueue((q) => [
      ...q,
      ...arrived.map((g) => ({ id: g.user_id, name: g.display_name ?? "" })),
    ]);
  }, [members]);

  const current = queue[0] ?? null;
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), WELCOME_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  return current;
}
