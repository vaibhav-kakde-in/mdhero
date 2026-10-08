import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clampTocWidth,
  maxTocWidthFor,
  MIN_DOCUMENT_WIDTH,
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

// The three blocking findings from the independent review of #111 — all of
// which a green gate, green CI and a passing visual smoke failed to catch,
// because every test here exercised the pure clamp and nothing else.
describe("the viewport ceiling (#111 finding 3)", () => {
  it("never lets the sidebar exceed the window minus a readable document", () => {
    // tauri.conf.json lets the window shrink to 400px. At that size a 520px
    // sidebar covers the document AND puts the drag handle off-screen, so
    // there is no pointer route back — issue #108's own complaint, recreated.
    // At 400px the MIN_TOC_WIDTH floor wins over 400 - MIN_DOCUMENT_WIDTH,
    // which is intended: a cramped sidebar beats an ungrabbable one. What
    // matters is that it no longer exceeds the window.
    expect(maxTocWidthFor(400)).toBe(MIN_TOC_WIDTH);
    expect(maxTocWidthFor(400)).toBeLessThan(400);
    // Where the window is wide enough for the subtraction to bite, it does.
    expect(maxTocWidthFor(600)).toBe(600 - MIN_DOCUMENT_WIDTH);
  });

  it("still honours the static maximum on a wide window", () => {
    expect(maxTocWidthFor(2560)).toBe(MAX_TOC_WIDTH);
  });

  it("keeps the handle grabbable even on an absurdly narrow window", () => {
    // Better a cramped sidebar than one that cannot be grabbed at all.
    expect(maxTocWidthFor(100)).toBe(MIN_TOC_WIDTH);
    expect(maxTocWidthFor(0)).toBe(MIN_TOC_WIDTH);
  });

  it("clamps a stored width down when the window is narrower than it", () => {
    expect(clampTocWidth(MAX_TOC_WIDTH, 400)).toBe(maxTocWidthFor(400));
  });

  it("leaves the static behaviour untouched when no viewport is given", () => {
    // The pure two-argument-less form is still what persistence uses.
    expect(clampTocWidth(MAX_TOC_WIDTH)).toBe(MAX_TOC_WIDTH);
    expect(clampTocWidth(9999)).toBe(MAX_TOC_WIDTH);
  });

  it("ignores a nonsense viewport rather than collapsing the sidebar", () => {
    expect(clampTocWidth(300, Number.NaN)).toBe(300);
    expect(clampTocWidth(300, Number.POSITIVE_INFINITY)).toBe(300);
  });
});

/**
 * Source-level guards for the drag lifecycle (#111 findings 1 and 2).
 *
 * These are the two failures that leak `html.toc-resizing`, whose
 * `user-select: none` sits on the root element — so leaking it makes nothing
 * in the app selectable until restart. Neither is reachable from a node test
 * (no DOM, no pointer events, no component lifecycle), and both survived a
 * green gate, green CI and a passing visual smoke. A regex over the source is
 * a weak check, but it is stronger than the nothing that was there before.
 */
describe("the drag lifecycle", () => {
  // The handle lives in PanelResizer, shared by the ToC and the side tabs
  // panel, so the guards read that component.
  const component = readFileSync(
    resolve(process.cwd(), "src/lib/components/PanelResizer.svelte"),
    "utf8",
  );

  it("is the resizer both side panels use", () => {
    for (const panel of ["TableOfContents.svelte", "TabBar.svelte"]) {
      const source = readFileSync(resolve(process.cwd(), "src/lib/components", panel), "utf8");
      expect(source).toContain("<PanelResizer");
    }
  });

  it("cleans up before it commits, so a throw cannot strand the global class", () => {
    const body = component.slice(component.indexOf("function endGesture"));
    const detached = body.indexOf("detach()");
    const unclassed = body.indexOf("classList.remove(resizingClass)");
    const committed = body.indexOf("onCommit(");
    expect(detached).toBeGreaterThan(-1);
    expect(unclassed).toBeGreaterThan(detached);
    expect(committed).toBeGreaterThan(unclassed);
  });

  it("guards releasePointerCapture, which throws once the pointer is gone", () => {
    // Specified to throw NotFoundError for an inactive pointerId — exactly the
    // pointercancel case. Unguarded and placed first, it skipped every line of
    // cleanup after it.
    expect(component).toContain("releasePointerCapture");
    // A try block whose body reaches releasePointerCapture before any closing
    // brace — i.e. the call is genuinely inside the try, not merely near one.
    expect(component).toMatch(/try\s*\{[^}]*releasePointerCapture/);
  });

  it("ends the gesture on unmount", () => {
    // The component is mounted conditionally, so Cmd+T or Cmd+W mid-drag takes
    // the handle out of the DOM and its pointerup never arrives.
    expect(component).toMatch(/onDestroy\(\s*\(\)\s*=>\s*endGesture/);
  });

  it("paints on key repeat and commits on release, not per repeat", () => {
    // Committing per keydown wrote localStorage once per OS key repeat.
    expect(component).toMatch(/function handleKeyup/);
    expect(component).toMatch(/onkeyup=\{handleKeyup\}/);
  });

  it("reports the live width to assistive tech during a drag", () => {
    expect(component).toMatch(/aria-valuenow=\{liveWidth \?\? width\}/);
  });
});
