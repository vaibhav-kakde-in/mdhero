import { describe, expect, it } from "vitest";
import { scopeCss, parseUserTemplate, UnsafeCssError } from "../../src/lib/templates/user";
import { BUILTIN_TEMPLATES, mergeTemplates, resolveTemplate } from "../../src/lib/templates";

/** Every top-level selector in `css` (rules inside @media included). */
function selectors(css: string): string[] {
  return [...css.matchAll(/(?:^|\})\s*([^{}@]+?)\s*\{/g)].map((m) => m[1].trim());
}

describe("scopeCss: selectors", () => {
  it("puts plain selectors under the page", () => {
    expect(scopeCss("h1, p > em { color: red }")).toBe(".doc-page h1, .doc-page p > em { color: red }\n");
  });

  it("maps the roots other apps style onto the page itself", () => {
    const out = scopeCss(":root { --a: 1 } body { font: 12pt serif } #write > p { margin: 0 } html body #write h1 { x: y }");
    expect(selectors(out)).toEqual([".doc-page", ".doc-page", ".doc-page > p", ".doc-page h1"]);
  });

  it("leaves already-scoped rules alone, so a duplicated built-in survives", () => {
    const memo = BUILTIN_TEMPLATES.find((t) => t.id === "memo")!.css;
    for (const sel of selectors(scopeCss(memo))) {
      expect(sel.startsWith(".doc-page")).toBe(true);
      expect(sel).not.toContain(".doc-page .doc-page");
    }
  });

  it("doesn't mistake a longer name for the scope", () => {
    expect(scopeCss(".doc-pager { a: b }")).toContain(".doc-page .doc-pager");
  });

  it("keeps commas inside :is() and attribute values in one selector", () => {
    expect(scopeCss(':is(h1, h2) a[title="x,y"] { a: b }')).toContain('.doc-page :is(h1, h2) a[title="x,y"]');
  });

  it("scopes rules inside @media and keeps the condition", () => {
    expect(scopeCss("@media print { h1 { a: b } }")).toBe("@media print {\n.doc-page h1 { a: b }\n}\n");
  });

  it("keeps escaped selectors as written", () => {
    expect(scopeCss(".md\\:flex { a: b }")).toContain(".doc-page .md\\:flex");
  });
});

describe("scopeCss: nothing leaves the app", () => {
  it("drops @import, nested or not", () => {
    const out = scopeCss('@import url("https://x/a.css"); @media screen { @import "b.css"; p { a: b } }');
    expect(out).not.toMatch(/@import|https:/);
    expect(out).toContain(".doc-page p");
  });

  it("replaces remote and relative url() but keeps data: urls", () => {
    const out = scopeCss(
      'p { background: url(https://evil.example/?q) } a { background: url("img.png") } b { background: url(data:image/png;base64,AAA) }',
    );
    expect(out).not.toContain("evil");
    expect(out).not.toContain("img.png");
    expect(out).toContain("url(data:image/png;base64,AAA)");
  });

  it("sees through escapes in values", () => {
    const out = scopeCss("p { background: \\75 rl(https://evil.example/x) }");
    expect(out).not.toContain("evil");
  });

  it("removes image-set and remote fonts", () => {
    const out = scopeCss('p { background: image-set("a.png" 1x) } @font-face { font-family: X; src: url(https://f/x.woff2) }');
    expect(out).not.toMatch(/a\.png|https:/);
    expect(out).toContain("@font-face");
  });

  it("drops @page, which the template's margin owns", () => {
    expect(scopeCss("@page { margin: 0 } p { a: b }")).not.toContain("@page");
  });

  it("ignores quotes and braces inside comments", () => {
    expect(scopeCss("/* don't { */ p { a: b }")).toBe(".doc-page p { a: b }\n");
  });
});

describe("scopeCss: refuses CSS the browser could split differently", () => {
  // Each of these would let text the scanner reads as one rule's value become
  // a separate, unscoped rule in the browser.
  it("keeps a hex-escaped brace escaped, where the browser reads it as text", () => {
    const out = scopeCss("p { color: red\\7d  body \\7b  background: red \\7d }");
    expect(out).toContain("\\7d");
    expect(selectors(out)).toEqual([".doc-page p"]);
  });

  it.each([
    ["a literally escaped brace", "p { a: b\\} body { background: red }"],
    ["a string broken by a newline", 'p { content: "x\n } body { background: red } q { a: "y }'],
    ["an unclosed string", 'p { content: "x }'],
    ["an unclosed block", "p { a: b"],
    ["a stray closing brace", "p { a: b } } body { c: d }"],
  ])("%s", (_name, css) => {
    expect(() => scopeCss(css)).toThrow(UnsafeCssError);
  });

  it("still decodes escapes that stay letters", () => {
    expect(scopeCss("p { font-family: \\46 oo }")).toContain("font-family: Foo");
  });

  it("keeps escaped quote marks inside strings", () => {
    expect(scopeCss('blockquote::before { content: "\\201C" }')).toContain('content: "\\201C"');
  });
});

describe("parseUserTemplate", () => {
  it("reads name and margin from template.json", () => {
    const tpl = parseUserTemplate({ id: "acme", json: '{"name":"Acme memo","margin":"20mm 25mm"}', css: "p{}" });
    expect(tpl).toMatchObject({ id: "acme", name: "Acme memo", margin: "20mm 25mm", builtin: false });
    expect(tpl.css).toContain(".doc-page p");
  });

  it("falls back on a missing or broken template.json", () => {
    expect(parseUserTemplate({ id: "a", json: null, css: "" })).toMatchObject({ name: "a", margin: "1in" });
    expect(parseUserTemplate({ id: "a", json: "{nope", css: "" })).toMatchObject({ name: "a", margin: "1in" });
  });

  it("refuses a margin that isn't plain lengths, since it lands in @page", () => {
    for (const margin of ["1in; } body { x: y", "calc(1in)", "1em", "1in 1in 1in 1in 1in"]) {
      expect(parseUserTemplate({ id: "a", json: JSON.stringify({ margin }), css: "" }).margin).toBe("1in");
    }
  });

  it("keeps a template with refused CSS visible, with the reason", () => {
    const tpl = parseUserTemplate({ id: "bad", json: null, css: "p { a: b" });
    expect(tpl.css).toBe("");
    expect(tpl.error).toBeTruthy();
  });
});

describe("mergeTemplates", () => {
  it("lets a user folder replace a built-in of the same name, in place", () => {
    const mine = parseUserTemplate({ id: "memo", json: '{"name":"Our memo"}', css: "" });
    const extra = parseUserTemplate({ id: "acme", json: null, css: "" });
    const all = mergeTemplates([extra, mine]);
    expect(all.map((t) => t.id)).toEqual(["report", "letter", "memo", "acme"]);
    expect(all[2].name).toBe("Our memo");
    expect(resolveTemplate(undefined, { template: "memo" }, "none", all)?.name).toBe("Our memo");
  });
});
