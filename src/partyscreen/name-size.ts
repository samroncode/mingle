/** The space the guest list gets on the TV, in rem (a conservative 720p). */
export const NAMES_AREA = { width: 48, height: 36 };

/** The longest a name can be before it is cut off with an ellipsis. */
export const NAME_MAX_CH = 20;

const SIZES_REM = [3, 2.5, 2, 1.75, 1.5, 1.25, 1];
const MIN_SIZE_REM = 1;
const COLUMN_GAP_REM = 2;
const ROW_GAP_REM = 0.5;
const CHAR_WIDTH_EM = 0.6;
const LINE_HEIGHT_EM = 1.5;

/** Whether `names` laid out as wrapped one-line items fit at `sizeRem`. */
export function namesFit(names: string[], sizeRem: number): boolean {
  let rows = names.length > 0 ? 1 : 0;
  let used = 0;
  for (const name of names) {
    const chars = Math.min(name.length, NAME_MAX_CH);
    const width = chars * CHAR_WIDTH_EM * sizeRem;
    if (used > 0 && used + COLUMN_GAP_REM + width > NAMES_AREA.width) {
      rows += 1;
      used = 0;
    }
    used += (used > 0 ? COLUMN_GAP_REM : 0) + width;
  }
  const height = rows * (sizeRem * LINE_HEIGHT_EM + ROW_GAP_REM) - ROW_GAP_REM;
  return height <= NAMES_AREA.height;
}

/**
 * The biggest text size at which all the names fit the area; the smallest
 * size when none does, where the area clips the overflow.
 */
export function nameSizeRem(names: string[]): number {
  const fitting = SIZES_REM.find((size) => namesFit(names, size));
  return fitting ?? MIN_SIZE_REM;
}
