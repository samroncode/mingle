/** The size the TV is laid out at before it is scaled down into the column. */
export const TV_WIDTH = 1920;
export const TV_HEIGHT = 1080;

/** How much the 1920 px TV shrinks to fit a box of this width. */
export function mirrorScale(width: number): number {
  return width > 0 ? width / TV_WIDTH : 0;
}
