// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The longest each part of the party content may be; the wizard uses these too. */
export const partyLimits = {
  welcome: 500,
  /** One menu line, or one schedule line's title. */
  line: 80,
  /** Menu lines, and schedule lines. */
  lines: 20,
  ssid: 32,
  password: 63,
  musicUrl: 500,
  /** Winners on the winners slide. */
  winners: 8,
  /** A winner's title (the contest) and name. */
  winnerText: 40,
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Makes a pasted music link forgiving: removes stray whitespace and
 * zero-width characters, upgrades http:// to https:// and adds https:// when
 * there is no scheme. Any other scheme (javascript:, data:, ftp:, ...) is left
 * as it is, so validation rejects it. Idempotent. The shared schema runs this,
 * so the client and the Edge Function store the same clean link.
 */
export function normalizeMusicUrl(input: string): string {
  const cleaned = input.replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, "");
  if (cleaned === "") return "";
  if (/^https:\/\//i.test(cleaned)) return `https://${cleaned.slice(8)}`;
  if (/^http:\/\//i.test(cleaned)) return `https://${cleaned.slice(7)}`;
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  if (/^[^/?#]*:/.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

/** A valid link has a dotted host and no embedded credentials. */
function isPlainHost(link: string): boolean {
  try {
    const url = new URL(link);
    return url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** One line of the evening's schedule, such as 19:00 Dinner. */
export const ScheduleItemSchema = z.strictObject({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: text(partyLimits.line),
});

/** One winner: what they won and who won, both free text. */
export const WinnerSchema = z.strictObject({
  title: text(partyLimits.winnerText),
  name: text(partyLimits.winnerText),
});

/** Wifi details for the QR code. An empty password means an open network. */
export const WifiSchema = z.strictObject({
  ssid: text(partyLimits.ssid),
  password: z.string().max(partyLimits.password),
});

/**
 * The party-screen content in `events.party`. Everything here is written or
 * approved by the host, so every member of the event may read it. Each part
 * is optional: the party screen skips what the host left out.
 */
export const PartySchema = z.strictObject({
  welcome: text(partyLimits.welcome).optional(),
  menu: z.array(text(partyLimits.line)).max(partyLimits.lines).optional(),
  schedule: z.array(ScheduleItemSchema).max(partyLimits.lines).optional(),
  wifi: WifiSchema.optional(),
  /** A Spotify Jam or shared playlist link, shown as a QR code. */
  musicUrl: z
    .preprocess(
      (value) => (typeof value === "string" ? normalizeMusicUrl(value) : value),
      z
        .url({ protocol: /^https$/ })
        .max(partyLimits.musicUrl)
        .refine(isPlainHost),
    )
    .optional(),
  /** Small contests the host announces, such as the dart tournament. */
  winners: z.array(WinnerSchema).max(partyLimits.winners).optional(),
  /** Hides the winners slide while keeping the list. */
  winnersHidden: z.boolean().optional(),
});

export type Party = z.infer<typeof PartySchema>;
