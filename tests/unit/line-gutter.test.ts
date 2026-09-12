import { describe, expect, it } from "vitest";
import { gutterHtml, gutterWidth, lineCount } from "../../src/lib/utils/line-gutter";

describe("lineCount", () => {
  it("counts a single line with no trailing newline", () => {
    expect(lineCount("only line")).toBe(1);
  });

  it("counts the empty document as one line", () => {
    expect(lineCount("")).toBe(1);
  });

  it("counts the empty line a trailing newline creates", () => {
    expect(lineCount("a\nb\n")).toBe(3);
  });
});

describe("gutterWidth", () => {
  it("reserves two digits even for short documents", () => {
    expect(gutterWidth(1)).toBe("calc(2ch + 16px)");
    expect(gutterWidth(9)).toBe("calc(2ch + 16px)");
    expect(gutterWidth(99)).toBe("calc(2ch + 16px)");
  });

  it("grows with the digit count so numbers never clip", () => {
    expect(gutterWidth(100)).toBe("calc(3ch + 16px)");
    expect(gutterWidth(1000)).toBe("calc(4ch + 16px)");
  });

  it("does not collapse below two digits for an empty document", () => {
    expect(gutterWidth(0)).toBe("calc(2ch + 16px)");
  });
});

describe("gutterHtml", () => {
  it("emits one block per logical line", () => {
    expect(gutterHtml("a\nb\nc")).toBe(
      '<div class="gl">a</div><div class="gl">b</div><div class="gl">c</div>'
    );
  });

  it("escapes markup so source text cannot inject nodes into the mirror", () => {
    expect(gutterHtml('<img src=x onerror="alert(1)"> & <b>')).toBe(
      '<div class="gl">&lt;img src=x onerror="alert(1)"&gt; &amp; &lt;b&gt;</div>'
    );
  });

  it("gives empty lines a zero-width space so they keep one line box", () => {
    // Without this the block collapses to zero height and every number below it
    // drifts out of alignment with the text.
    expect(gutterHtml("a\n\nb")).toBe(
      '<div class="gl">a</div><div class="gl">​</div><div class="gl">b</div>'
    );
  });

  it("marks the active line when one is given", () => {
    expect(gutterHtml("a\nb", 1)).toBe(
      '<div class="gl">a</div><div class="gl active">b</div>'
    );
  });

  it("marks no line active by default, as the raw view has no caret", () => {
    expect(gutterHtml("a\nb")).not.toContain("active");
  });

  it("keeps the block count equal to the line count", () => {
    const text = "one\n\nthree\nfour\n";
    const blocks = gutterHtml(text).match(/<div class="gl/g) ?? [];
    expect(blocks.length).toBe(lineCount(text));
  });
});
