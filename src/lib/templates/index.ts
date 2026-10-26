import baseCss from "./base.css?raw";
import reportCss from "./report.css?raw";
import letterCss from "./letter.css?raw";
import memoCss from "./memo.css?raw";
import type { MessageKey } from "$lib/i18n/types";

export type PageSize = "letter" | "a4";

export interface DocTemplate {
  id: string;
  /** i18n key for a built-in template's name. */
  nameKey?: MessageKey;
  /** A user template's name, from its template.json. */
  name?: string;
  /** Rules scoped under `.doc-page`, the article while a template is active. */
  css: string;
  /** Page margin, used for both the on-screen sheet and `@page`. */
  margin: string;
  builtin: boolean;
  /** Why a user template's CSS was refused; it then shows as a blank page. */
  error?: string;
}

/** Stored as an override or default, and accepted in frontmatter, to mean the
 *  normal reader view even when something else would pick a template. */
export const NO_TEMPLATE = "none";

export const BUILTIN_TEMPLATES: DocTemplate[] = [
  { id: "report", nameKey: "templates.report", css: reportCss, margin: "1in", builtin: true },
  { id: "letter", nameKey: "templates.letter", css: letterCss, margin: "1in", builtin: true },
  { id: "memo", nameKey: "templates.memo", css: memoCss, margin: "1in", builtin: true },
];

export function templateLabel(tpl: DocTemplate, translate: (key: MessageKey) => string): string {
  return tpl.nameKey ? translate(tpl.nameKey) : tpl.name ?? tpl.id;
}

/**
 * Built-ins and the user's folder as one list. A user folder named like a
 * built-in replaces it, so `template: memo` documents pick up a customised
 * memo without being edited.
 */
export function mergeTemplates(user: DocTemplate[], builtin: DocTemplate[] = BUILTIN_TEMPLATES): DocTemplate[] {
  const byId = new Map(user.map((tpl) => [tpl.id, tpl]));
  const merged = builtin.map((tpl) => byId.get(tpl.id) ?? tpl);
  return [...merged, ...user.filter((tpl) => !builtin.some((b) => b.id === tpl.id))];
}

const PAGE_SIZES: Record<PageSize, string> = {
  letter: "8.5in 11in",
  a4: "210mm 297mm",
};

export function findTemplate(
  id: string | null | undefined,
  templates: DocTemplate[] = BUILTIN_TEMPLATES,
): DocTemplate | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  return templates.find((tpl) => tpl.id === key) ?? null;
}

function frontmatterString(frontmatter: Record<string, unknown> | null, key: string): string | null {
  const value = frontmatter?.[key];
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

/**
 * The template a document shows with. A choice made for this file in the
 * toolbar beats the document's own `template:` frontmatter, because ignoring an
 * explicit pick would look broken; the frontmatter beats the app default so a
 * file carries its layout to other machines. An unknown name at any level is
 * skipped rather than blanking the layout.
 */
export function resolveTemplate(
  override: string | null | undefined,
  frontmatter: Record<string, unknown> | null,
  fallback: string,
  templates: DocTemplate[] = BUILTIN_TEMPLATES,
): DocTemplate | null {
  for (const id of [override, frontmatterString(frontmatter, "template"), fallback]) {
    if (!id) continue;
    if (id.trim().toLowerCase() === NO_TEMPLATE) return null;
    const tpl = findTemplate(id, templates);
    if (tpl) return tpl;
  }
  return null;
}

/** Pandoc's `papersize` variable, including its LaTeX spellings (`a4paper`). */
export function resolvePageSize(frontmatter: Record<string, unknown> | null, fallback: PageSize): PageSize {
  const value = frontmatterString(frontmatter, "papersize")?.replace(/paper$/, "");
  return value === "a4" || value === "letter" ? value : fallback;
}

/** Everything a template needs in the page: the sheet, its rules, and `@page`. */
export function templateStylesheet(tpl: DocTemplate, pageSize: PageSize): string {
  return [
    baseCss,
    `.doc-page { --page-margin: ${tpl.margin}; }`,
    `@page { size: ${PAGE_SIZES[pageSize]}; margin: ${tpl.margin}; }`,
    tpl.css,
  ].join("\n");
}
