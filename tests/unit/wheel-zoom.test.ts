import { describe, expect, it } from "vitest";
import { createWheelZoom } from "../../src/lib/utils/wheel-zoom";
import { stepFontSize, MIN_FONT_SIZE, MAX_FONT_SIZE } from "../../src/lib/stores/settings";

const PIXEL = 0;
const LINE = 1;

describe("createWheelZoom", () => {
  it("zooms in on wheel up and out on wheel down", () => {
    const step = createWheelZoom();
    expect(step({ deltaY: -100, deltaMode: PIXEL })).toBe(1);
    expect(step({ deltaY: 100, deltaMode: PIXEL })).toBe(-1);
  });

  it("takes exactly one step per mouse notch, whatever the display scaling", () => {
    // WebView2 reports a notch as 100px at 100% scaling and more above it; a
    // large delta must not turn into several steps.
    for (const delta of [100, 120, 150, 250]) {
      const step = createWheelZoom();
      expect(step({ deltaY: -delta, deltaMode: PIXEL })).toBe(1);
      expect(step({ deltaY: -delta, deltaMode: PIXEL })).toBe(1);
    }
  });

  it("accumulates the small deltas of a touchpad pinch", () => {
    const step = createWheelZoom();
    const results = Array.from({ length: 10 }, () => step({ deltaY: -10, deltaMode: PIXEL }));
    // 100px in 10px increments: a step each time 40px have built up.
    expect(results.filter((r) => r === 1)).toHaveLength(2);
    expect(results.filter((r) => r === -1)).toHaveLength(0);
  });

  it("starts over when the direction changes", () => {
    const step = createWheelZoom();
    expect(step({ deltaY: -30, deltaMode: PIXEL })).toBe(0);
    // Without the reset, -30 + 30 would cancel out and this would still be 0.
    expect(step({ deltaY: 30, deltaMode: PIXEL })).toBe(0);
    expect(step({ deltaY: 30, deltaMode: PIXEL })).toBe(-1);
  });

  it("treats a line-mode notch like a pixel one", () => {
    const step = createWheelZoom();
    expect(step({ deltaY: -3, deltaMode: LINE })).toBe(1);
    expect(step({ deltaY: 1, deltaMode: LINE })).toBe(-1);
  });

  it("ignores a purely horizontal scroll", () => {
    const step = createWheelZoom();
    expect(step({ deltaY: 0, deltaMode: PIXEL })).toBe(0);
  });
});

describe("stepFontSize", () => {
  it("moves by the given number of steps", () => {
    expect(stepFontSize(17, 1)).toBe(18);
    expect(stepFontSize(17, -1)).toBe(16);
  });

  it("stays within the zoom bounds", () => {
    expect(stepFontSize(MAX_FONT_SIZE, 1)).toBe(MAX_FONT_SIZE);
    expect(stepFontSize(MIN_FONT_SIZE, -1)).toBe(MIN_FONT_SIZE);
  });
});
