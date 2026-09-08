import { describe, expect, it } from "vitest";
import {
  clampTocWidth,
  DEFAULT_TOC_WIDTH,
  MIN_TOC_WIDTH,
  MAX_TOC_WIDTH,
} from "../../src/lib/stores/settings";

// The ToC sidebar width (#108) is written from two untrusted-ish sources: a
// pointer drag and whatever happens to be in localStorage. Both funnel through
// clampTocWidth, so a bad value can never collapse the sidebar to nothing or
// let it cover the document.
describe("clampTocWidth", () => {
  it("keeps a width that is already in range", () => {
    expect(clampTocWidth(240)).toBe(240);
    expect(clampTocWidth(MIN_TOC_WIDTH)).toBe(MIN_TOC_WIDTH);
    expect(clampTocWidth(MAX_TOC_WIDTH)).toBe(MAX_TOC_WIDTH);
  });

  it("clamps a drag past either bound", () => {
    // Dragging the handle to the left edge of the screen, or off the right.
    expect(clampTocWidth(0)).toBe(MIN_TOC_WIDTH);
    expect(clampTocWidth(-500)).toBe(MIN_TOC_WIDTH);
    expect(clampTocWidth(99999)).toBe(MAX_TOC_WIDTH);
  });

  it("rounds sub-pixel pointer positions to whole pixels", () => {
    // Pointer events report fractional coordinates on scaled displays.
    expect(clampTocWidth(240.4)).toBe(240);
    expect(clampTocWidth(240.6)).toBe(241);
  });

  it("falls back to the default for junk rather than collapsing", () => {
    // A hand-edited or corrupted localStorage entry must not yield a 0-width
    // sidebar, which would be invisible and impossible to grab again.
    expect(clampTocWidth(undefined)).toBe(DEFAULT_TOC_WIDTH);
    expect(clampTocWidth(null)).toBe(DEFAULT_TOC_WIDTH);
    expect(clampTocWidth("wide")).toBe(DEFAULT_TOC_WIDTH);
    expect(clampTocWidth(NaN)).toBe(DEFAULT_TOC_WIDTH);
    expect(clampTocWidth(Infinity)).toBe(DEFAULT_TOC_WIDTH);
  });

  it("reads a numeric string, since JSON round-trips can widen the type", () => {
    expect(clampTocWidth("300")).toBe(300);
  });
});
