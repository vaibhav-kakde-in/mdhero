import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolvePageTheme, cyclePageTheme } from "../../src/lib/stores/theme";
import { SIDE_TABS_CHROME } from "../../src/lib/utils/layout";

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

// The page theme only applies once "Separate page theme" is on: off, the page
// follows the interface whatever pageTheme holds.
describe("applyCurrentTheme", () => {
  async function applied(separatePageTheme: boolean, interfaceTheme: "light" | "dark") {
    const classes = new Set<string>();
    vi.stubGlobal("document", {
      documentElement: {
        classList: {
          toggle: (name: string, on: boolean) => void (on ? classes.add(name) : classes.delete(name)),
        },
      },
    });
    vi.resetModules();
    const { get } = await import("svelte/store");
    const { settings } = await import("../../src/lib/stores/settings");
    const theme = await import("../../src/lib/stores/theme");
    theme.themeMode.set(interfaceTheme);
    settings.set({ ...get(settings), separatePageTheme, pageTheme: "dark" });
    theme.applyCurrentTheme();
    return { classes, pageDark: get(theme.pageDark) };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the interface when the setting is off, whatever the page theme", async () => {
    const { classes, pageDark } = await applied(false, "light");
    expect(pageDark).toBe(false);
    expect(classes.has("page-dark")).toBe(false);
  });

  it("uses the page theme when the setting is on", async () => {
    const { classes, pageDark } = await applied(true, "light");
    expect(pageDark).toBe(true);
    expect(classes.has("page-dark")).toBe(true);
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

  it("in the status bar and scroll button, which sit over the page", () => {
    // Over the rendered page they take the page theme; the bare `html.dark`
    // rules are left for the raw view, which shows no page.
    for (const file of ["StatusBar", "ScrollToTop"]) {
      const source = read(`src/lib/components/${file}.svelte`);
      expect(source).toContain("html.page-dark .page-canvas");
      expect(source).toContain("html .page-canvas");
    }
  });

  it("in the split view, whose preview keeps the page theme next to the editor", () => {
    // The page setting is not overridden while editing: a light page stays
    // light beside a dark editor.
    expect(read("src/routes/+page.svelte")).not.toContain("splitView");
    expect(read("src/lib/stores/theme.ts")).not.toContain("splitView");
  });

  it("in the editor, alone as well as next to the preview", () => {
    // Its styles key off its own flag, the page's theme. A bare `html.dark`
    // rule, or a flag that falls back to the interface's theme, would bring
    // back a dark editor on a light page.
    const editor = read("src/lib/components/Editor.svelte");
    expect(editor).not.toContain(":global(html.dark)");
    expect(editor).toContain("let dark = $derived($pageDark);");
  });

  it("without tinting the toolbar when the two themes differ", () => {
    // The bar is translucent, so over a page canvas of the other theme it
    // changes shade between the viewer and the editor. It keeps the
    // interface's own colour when the page's theme differs, and the rules must
    // not fire in Auto, where the two agree.
    const toolbar = read("src/lib/components/Toolbar.svelte");
    expect(toolbar).toContain(":global(html.dark:not(.page-dark)) .toolbar");
    expect(toolbar).toContain(":global(html:not(.dark).page-dark) .toolbar");
  });

  it("without a seam under the toolbar", () => {
    // The fixed panels start at SIDE_TABS_CHROME. A bar shorter than that
    // leaves a strip of the window between them: invisible while the window
    // is the interface's colour, a light line once the page canvas is lighter.
    const toolbar = read("src/lib/components/Toolbar.svelte");
    expect(toolbar).toContain(`min-height: ${SIDE_TABS_CHROME}px;`);
  });

  it("in the Quick Look preview, which reuses the renderer's styles", () => {
    expect(read("src/quicklook/preview.ts")).toContain('classList.toggle("page-dark"');
  });
});
