import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolvePageTheme, cyclePageTheme } from "../../src/lib/stores/theme";

// The rendered page has a theme of its own, apart from the interface's.
describe("resolvePageTheme", () => {
  it("follows the interface on auto", () => {
    expect(resolvePageTheme("auto", "light")).toBe("light");
    expect(resolvePageTheme("auto", "dark")).toBe("dark");
  });

  it("ignores the interface once set", () => {
    expect(resolvePageTheme("light", "dark")).toBe("light");
    expect(resolvePageTheme("dark", "light")).toBe("dark");
  });
});

describe("cyclePageTheme", () => {
  it("goes auto, light, dark and round again", () => {
    expect(cyclePageTheme("auto")).toBe("light");
    expect(cyclePageTheme("light")).toBe("dark");
    expect(cyclePageTheme("dark")).toBe("auto");
  });
});

/**
 * Source-level guards. The split only holds while every page style keys off
 * `page-dark`: one `html.dark` rule creeping back into the page would paint
 * that part in the interface's colours, which with the default "auto" looks
 * identical and so would go unnoticed.
 */
describe("the page styles follow the page theme", () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

  it("in the rendered document", () => {
    const renderer = read("src/lib/components/MarkdownRenderer.svelte");
    expect(renderer).not.toContain("html.dark");
    expect(renderer).not.toMatch(/(?<!page-)dark:prose-invert/);
    expect(renderer).toContain("page-dark:prose-invert");
  });

  it("in the frontmatter bar and the search highlights on the page", () => {
    expect(read("src/lib/components/FrontmatterBar.svelte")).not.toContain("html.dark");
    const search = read("src/lib/components/SearchOverlay.svelte");
    expect(search).not.toMatch(/html\.dark mark\./);
    expect(search).toMatch(/html\.page-dark mark\.mdv-search-highlight/);
  });

  it("in the Quick Look preview, which reuses the renderer's styles", () => {
    expect(read("src/quicklook/preview.ts")).toContain('classList.toggle("page-dark"');
  });
});
