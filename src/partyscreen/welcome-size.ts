/**
 * The text size and line width of the welcome on the TV: the shorter the text, the bigger it
 * is, so a short greeting fills the screen and a long one still fits beside
 * the join card and above the rotating part.
 */
export function welcomeSize(text: string): string {
  const length = text.trim().length;
  if (length <= 24) return "max-w-[14ch] text-9xl leading-[0.95]";
  if (length <= 60) return "max-w-[20ch] text-7xl leading-[1.02]";
  if (length <= 140) return "max-w-[34ch] text-5xl leading-tight";
  return "max-w-[44ch] text-4xl leading-snug";
}
