import { describe, it, expect, vi } from "vitest";

// The unit env has no DOM, so DOMPurify is a passthrough here, as in
// rtl-direction.test.ts. What survives the real sanitizer is checked by
// rendering in the app.
vi.mock("dompurify", () => ({ default: { sanitize: (html: string) => html } }));

const { render } = await import("../../src/lib/renderer/pipeline");

describe("footnotes", () => {
  const html = render("A claim[^1] and another[^note], and the first again[^1].\n\n[^1]: First.\n[^note]: Second, *styled*.");

  it("numbers references in order of first use, as bare superscripts", () => {
    expect(html).toContain('<sup class="footnote-ref"><a href="#fn1" id="fnref1">1</a></sup>');
    expect(html).toContain('<sup class="footnote-ref"><a href="#fn2" id="fnref2">2</a></sup>');
  });

  it("shows a repeated reference with the same number", () => {
    expect(html).toContain('<a href="#fn1" id="fnref1:1">1</a>');
  });

  it("lists the notes at the end with links back to each reference", () => {
    expect(html).toMatch(/<section class="footnotes">[\s\S]*<li id="fn1"[\s\S]*<li id="fn2"/);
    expect(html).toContain('href="#fnref1" class="footnote-backref"');
    expect(html).toContain('href="#fnref1:1" class="footnote-backref"');
    expect(html).toContain("<em>styled</em>");
  });

  it("leaves an undefined reference as text", () => {
    expect(render("Nothing defined[^x].")).toContain("[^x]");
  });
});
