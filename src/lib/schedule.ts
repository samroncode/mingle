/** A schedule line as stored: the time is optional. */
interface TimedLine {
  time?: string;
  title: string;
}

/** Whether any line has a time; if none does, the time column is left out. */
export function anyLineHasTime(lines: readonly TimedLine[]): boolean {
  return lines.some((line) => Boolean(line.time));
}

/** One line as text: "19:00 Dinner", or just "Darts" with no time. */
export function formatScheduleLine(line: TimedLine): string {
  return line.time ? `${line.time} ${line.title}` : line.title;
}
