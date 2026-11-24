import { describe, it, expect, vi } from "vitest";

// The unit env is node (no DOM): DOMPurify only sanitizes, and every assertion
// here is about the ids markdown-it produced, so a passthrough stub is faithful.
vi.mock("dompurify", () => ({ default: { sanitize: (html: string) => html } }));

const { render, slugifyHeading } = await import("../../src/lib/renderer/pipeline");

// A generated table of contents links `[title](#slug)` with the slug GitHub and
// VS Code compute. Only the first link of such a plan worked here: the slug used
// an ASCII-only `\w`, which stripped accents, and collapsed the double hyphen
// left by a removed em dash.
describe("heading anchors match GitHub / VS Code", () => {
  const cases: [string, string][] = [
    ["1. Contexte", "1-contexte"],
    ["Suites prévues", "suites-prévues"],
    ["Historique de révision", "historique-de-révision"],
    // The dash is dropped but both spaces around it become hyphens.
    [
      "2. Message 1 — Hugues Doillon → Frédéric Sauvé, Alexis Boisroux · brouillon",
      "2-message-1--hugues-doillon--frédéric-sauvé-alexis-boisroux--brouillon",
    ],
    ["Straße & Ünïcödé", "straße--ünïcödé"],
    ["Snake_case and-dash", "snake_case-and-dash"],
    ["日本語 の 見出し", "日本語-の-見出し"],
  ];

  it.each(cases)("slugifies %j", (title, slug) => {
    expect(slugifyHeading(title)).toBe(slug);
  });

  it("gives the heading the id that its in-page link points to", () => {
    const html = render("## Suites prévues\n\n[go](#suites-prévues)\n");
    expect(html).toContain('id="suites-prévues"');
    // markdown-it percent-encodes the href; the browser decodes the fragment
    // before matching it against ids.
    const href = /<a href="([^"]*)">go<\/a>/.exec(html)?.[1] ?? "";
    expect(decodeURIComponent(href)).toBe("#suites-prévues");
  });
});
