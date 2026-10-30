/** The most characters a notice can have. Matches the database check. */
export const noticeMaxLength = 140;

/** Characters the host can still type; negative when over the limit. */
export function charactersLeft(text: string): number {
  return noticeMaxLength - text.trim().length;
}

/** Whether `text` can be sent: not empty once trimmed, and not too long. */
export function canSendNotice(text: string): boolean {
  const left = charactersLeft(text);
  return left >= 0 && left < noticeMaxLength;
}

/** The clock time a notice was sent, such as "14:05", in the UI language. */
export function formatSentTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
