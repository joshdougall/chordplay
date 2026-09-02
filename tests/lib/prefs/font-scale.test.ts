import { describe, it, expect } from "vitest";
import { DEFAULT_PREFS } from "@/lib/prefs/defaults";
import { clampFontScale, FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP } from "@/lib/prefs/font-scale";

describe("font scale", () => {
  it("defaults to 1, i.e. today's size", () => {
    expect(DEFAULT_PREFS.fontScale ?? 1).toBe(1);
  });

  it("clamps below the minimum", () => {
    expect(clampFontScale(0.1)).toBe(FONT_SCALE_MIN);
  });

  it("clamps above the maximum, so the sheet cannot be made unusable", () => {
    expect(clampFontScale(99)).toBe(FONT_SCALE_MAX);
  });

  it("rounds to the step so repeated taps stay on clean values", () => {
    expect(clampFontScale(1 + FONT_SCALE_STEP)).toBeCloseTo(1 + FONT_SCALE_STEP, 5);
    expect(clampFontScale(1.0999999)).toBeCloseTo(1.1, 5);
  });

  it("survives a non-numeric value from a corrupt prefs file", () => {
    expect(clampFontScale(NaN)).toBe(1);
    expect(clampFontScale(undefined as unknown as number)).toBe(1);
  });
});
