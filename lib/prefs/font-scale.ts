/** Sheet text scale, as a multiplier on the base 1rem.
 *
 * The sheet size was hard-coded at 16px with no user control, which is
 * marginal on a stand at 60cm and too small at 100cm. Pinch-zoom is not a
 * substitute: it changes the layout viewport, which breaks the autoscroll row
 * map and re-triggers the horizontal-scroll trap.
 */
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 2.0;
export const FONT_SCALE_STEP = 0.1;

export function clampFontScale(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value));
  // Round to the step, then to 2dp, so 1.0999999 becomes 1.1 rather than drifting.
  return Math.round(clamped / FONT_SCALE_STEP) * FONT_SCALE_STEP;
}
