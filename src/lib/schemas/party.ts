// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

/** One line of the evening's schedule, such as 19:00 Dinner. */
export const ScheduleItemSchema = z.strictObject({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: text(80),
});

/** Wifi details for the QR code. An empty password means an open network. */
export const WifiSchema = z.strictObject({
  ssid: text(32),
  password: z.string().max(63),
});

/**
 * The party-screen content in `events.party`. Everything here is written or
 * approved by the host, so every member of the event may read it. Each part
 * is optional: the party screen skips what the host left out.
 */
export const PartySchema = z.strictObject({
  welcome: text(500).optional(),
  menu: z.array(text(80)).max(20).optional(),
  schedule: z.array(ScheduleItemSchema).max(20).optional(),
  wifi: WifiSchema.optional(),
  /** A Spotify Jam or shared playlist link, shown as a QR code. */
  musicUrl: z
    .url({ protocol: /^https$/ })
    .max(500)
    .optional(),
});

export type Party = z.infer<typeof PartySchema>;
