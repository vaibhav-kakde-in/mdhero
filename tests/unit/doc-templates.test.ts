import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import {
  BUILTIN_TEMPLATES,
  findTemplate,
  resolvePageSize,
  resolveTemplate,
  templateStylesheet,
} from "../../src/lib/templates";

const templatesDir = resolve(process.cwd(), "src/lib/templates");

describe("resolveTemplate", () => {
  it("prefers the toolbar choice, then frontmatter, then the default", () => {
    const fm = { template: "letter" };
    expect(resolveTemplate("memo", fm, "report")?.id).toBe("memo");
    expect(resolveTemplate(undefined, fm, "report")?.id).toBe("letter");
    expect(resolveTemplate(undefined, null, "report")?.id).toBe("report");
  });

  it("treats `none` at any level as the reader view", () => {
    expect(resolveTemplate("none", { template: "memo" }, "report")).toBeNull();
    expect(resolveTemplate(undefined, { template: "none" }, "report")).toBeNull();
    expect(resolveTemplate(undefined, null, "none")).toBeNull();
  });

  it("skips names it doesn't know instead of dropping the layout", () => {
    expect(resolveTemplate("gone", { template: "eisvogel" }, "memo")?.id).toBe("memo");
    expect(resolveTemplate(undefined, { template: "eisvogel" }, "none")).toBeNull();
  });

  it("matches frontmatter loosely and ignores non-string values", () => {
    expect(resolveTemplate(undefined, { template: "  Memo " }, "none")?.id).toBe("memo");
    expect(resolveTemplate(undefined, { template: ["memo"] }, "report")?.id).toBe("report");
  });
});

describe("resolvePageSize", () => {
  it("takes Pandoc's papersize, including the LaTeX spelling", () => {
    expect(resolvePageSize({ papersize: "a4" }, "letter")).toBe("a4");
    expect(resolvePageSize({ papersize: "A4paper" }, "letter")).toBe("a4");
    expect(resolvePageSize({ papersize: "letter" }, "a4")).toBe("letter");
  });

  it("falls back to the setting for anything else", () => {
    expect(resolvePageSize(null, "a4")).toBe("a4");
    expect(resolvePageSize({ papersize: "legal" }, "letter")).toBe("letter");
  });
});

describe("templateStylesheet", () => {
  it("sets @page size and margin from the template and page size", () => {
    const memo = findTemplate("memo")!;
    expect(templateStylesheet(memo, "a4")).toContain("@page { size: 210mm 297mm; margin: 1in; }");
    expect(templateStylesheet(memo, "letter")).toContain("@page { size: 8.5in 11in; margin: 1in; }");
  });
});

describe("built-in template CSS", () => {
  const files = ["base.css", ...BUILTIN_TEMPLATES.map((tpl) => `${tpl.id}.css`)];

  // The stylesheet goes into <head>, so an unscoped rule would restyle the
  // app's own chrome. Every selector has to live under the page.
  it.each(files)("%s only styles inside .doc-page", (file) => {
    const css = readFileSync(resolve(templatesDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1].trim())
      .filter((s) => !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const group of selectors) {
      for (const selector of group.split(/,(?![^(]*\))/)) {
        expect(selector.trim(), `in ${file}`).toMatch(/^\.doc-page(?![\w-])/);
      }
    }
  });

  it.each(files)("%s loads nothing from outside the app", (file) => {
    const css = readFileSync(resolve(templatesDir, file), "utf8");
    expect(css).not.toMatch(/@import|url\(/);
  });
});

describe("template settings", () => {
  async function loadSettingsWith(stored: string | null) {
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem: () => {} });
    vi.resetModules();
    const { settings } = await import("../../src/lib/stores/settings");
    return get(settings);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("default to the reader view on Letter paper", async () => {
    const s = await loadSettingsWith(null);
    expect(s.defaultTemplate).toBe("none");
    expect(s.pageSize).toBe("letter");
  });

  it("restore saved choices and reject junk", async () => {
    const saved = await loadSettingsWith(JSON.stringify({ defaultTemplate: "memo", pageSize: "a4" }));
    expect(saved.defaultTemplate).toBe("memo");
    expect(saved.pageSize).toBe("a4");

    const junk = await loadSettingsWith(JSON.stringify({ defaultTemplate: 3, pageSize: "tabloid" }));
    expect(junk.defaultTemplate).toBe("none");
    expect(junk.pageSize).toBe("letter");
  });
});

describe("template overrides", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persist per file and clear back to following the document", async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
    });
    vi.resetModules();
    const { templateOverrides, setTemplateOverride } = await import("../../src/lib/stores/docTemplate");

    setTemplateOverride("/docs/a.md", "memo");
    setTemplateOverride("/docs/b.md", "none");
    expect(JSON.parse(store["mdhero-template-overrides"])).toEqual({ "/docs/a.md": "memo", "/docs/b.md": "none" });

    setTemplateOverride("/docs/a.md", null);
    expect(get(templateOverrides)).toEqual({ "/docs/b.md": "none" });
  });

  it("ignore a corrupt stored value", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "[1,2]", setItem: () => {} });
    vi.resetModules();
    const { templateOverrides } = await import("../../src/lib/stores/docTemplate");
    expect(get(templateOverrides)).toEqual({});
  });
});
