import { z } from "zod";
import { nicheIds } from "@/niches/ids";
import { AdminKeySchema, EventCodeSchema } from "./schemas/host-actions";

/** Events are deleted 30 days after they are created. */
export const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const storageKey = "mingle.myEvents";

const MyEventSchema = z.object({
  code: EventCodeSchema,
  key: AdminKeySchema,
  niche: z.enum(nicheIds),
  createdAt: z.number().finite(),
});

/** An event created on this device, with its secret admin key. */
export type MyEvent = z.infer<typeof MyEventSchema>;

function readRaw(): unknown {
  try {
    const value = localStorage.getItem(storageKey);
    return value === null ? [] : JSON.parse(value);
  } catch {
    return [];
  }
}

function write(events: MyEvent[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(events));
  } catch {
    // Storage can be unavailable (private mode); the list is then not kept.
  }
}

/** The remembered events that are valid and not expired, newest first. */
export function loadMyEvents(now: number = Date.now()): MyEvent[] {
  const raw = readRaw();
  if (!Array.isArray(raw)) return [];
  const events: MyEvent[] = [];
  for (const item of raw) {
    const parsed = MyEventSchema.safeParse(item);
    if (parsed.success && now - parsed.data.createdAt < EVENT_RETENTION_MS) {
      events.push(parsed.data);
    }
  }
  return events.sort((a, b) => b.createdAt - a.createdAt);
}

/** Remembers an event on this device. */
export function addMyEvent(event: MyEvent, now: number = Date.now()): void {
  const others = loadMyEvents(now).filter((e) => e.code !== event.code);
  write([event, ...others]);
}

/** Forgets one event on this device only. */
export function forgetMyEvent(code: string, now: number = Date.now()): void {
  write(loadMyEvents(now).filter((e) => e.code !== code));
}
