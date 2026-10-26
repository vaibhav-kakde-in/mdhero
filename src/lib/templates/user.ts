import type { DocTemplate } from "./index";

/** What `list_user_templates` returns for one folder. */
export interface UserTemplateFiles {
  id: string;
  json: string | null;
  css: string;
}

export const SCOPE = ".doc-page";
export const DEFAULT_MARGIN = "1in";

const LENGTH = String.raw`(?:0|\d+(?:\.\d+)?(?:in|cm|mm|pt|pc|px))`;
/** One to four lengths, the shapes `margin` takes. It is written into `@page`
 *  and a custom property, so anything else is refused rather than escaped. */
const MARGIN = new RegExp(`^${LENGTH}(?: ${LENGTH}){0,3}$`);

/** Selectors other apps use for the document root: Typora styles `#write`,
 *  most themes put variables on `:root`. All of them mean the page here. */
const ROOT = /^\s*(?:html|body|:root|#write)(?![\w-])/i;

export class UnsafeCssError extends Error {}

export function parseUserTemplate(files: UserTemplateFiles): DocTemplate {
  let meta: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(files.json ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed;
  } catch {
    // A broken template.json still leaves a usable template: its CSS.
  }
  const name = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim().slice(0, 80) : files.id;
  const margin = typeof meta.margin === "string" && MARGIN.test(meta.margin.trim()) ? meta.margin.trim() : DEFAULT_MARGIN;
  try {
    return { id: files.id, name, css: scopeCss(files.css), margin, builtin: false };
  } catch (e) {
    const error = e instanceof UnsafeCssError ? e.message : String(e);
    return { id: files.id, name, css: "", margin, builtin: false, error };
  }
}

/**
 * Make a stylesheet from anywhere safe to put in the app's <head>:
 *
 * - every selector is moved under `.doc-page`, so a theme can't restyle the
 *   toolbar, tabs or dialogs;
 * - `url()` other than `data:` becomes `none`, and `@import` is dropped. The CSP
 *   allows https images for documents, so a remote background would otherwise
 *   be a way for a stylesheet to report on what it styles;
 * - `@page` is dropped: the template's margin and the page size setting own it,
 *   and the on-screen sheet has to agree with what prints.
 *
 * The output is rebuilt from this scanner's reading of the input, so the scanner
 * must split rules exactly where the browser will. Rather than chase every
 * corner of CSS tokenizing, input where the two could disagree (an unclosed
 * string, an escaped brace or quote, unbalanced braces) is refused outright;
 * real themes don't need any of it. Throws UnsafeCssError.
 */
export function scopeCss(css: string): string {
  const source = stripComments(css);
  assertUnambiguous(source);
  return scopeBlock(source);
}

/** Walk `css` and call `visit` on every character outside strings and escapes. */
function scan(css: string, from: number, visit: (c: string, i: number) => boolean | void): void {
  let quote: string | null = null;
  for (let i = from; i < css.length; i++) {
    const c = css[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (visit(c, i) === true) return;
  }
}

function stripComments(css: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\\") {
      out += c + (css[++i] ?? "");
    } else if (quote) {
      out += c;
      if (c === quote || c === "\n") quote = null;
    } else if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
    } else {
      if (c === '"' || c === "'") quote = c;
      out += c;
    }
  }
  return out;
}

function assertUnambiguous(css: string): void {
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\\") {
      const next = css[i + 1] ?? "";
      if (!quote && /[{};"'\n\r\f]/.test(next)) {
        throw new UnsafeCssError("an escaped brace, semicolon or quote outside a string");
      }
      i++;
    } else if (quote) {
      if (c === "\n" || c === "\r" || c === "\f") throw new UnsafeCssError("a string left open at the end of a line");
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "{") {
      depth++;
    } else if (c === "}" && --depth < 0) {
      throw new UnsafeCssError("a closing brace with no opening brace");
    }
  }
  if (quote) throw new UnsafeCssError("a string left open at the end of the file");
  if (depth !== 0) throw new UnsafeCssError("an opening brace that is never closed");
}

/** Decode `\75 ` style escapes outside strings, but only into characters that
 *  can't change how the text parses; anything else keeps its escape. */
function decodeEscapes(css: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === "\\") out += css[++i] ?? "";
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(css.slice(i + 1, i + 8));
    const raw = hex ? hex[0] : (css[i + 1] ?? "");
    const decoded = hex ? String.fromCodePoint(Math.min(parseInt(hex[0], 16), 0x10ffff) || 0xfffd) : raw;
    out += /^[A-Za-z0-9_-]$/.test(decoded) ? decoded : `\\${raw}`;
    i += raw.length;
  }
  return out;
}

/** Index of the `}` closing the block opened at `open`. */
function matchingBrace(css: string, open: number): number {
  let depth = 0;
  let close = css.length;
  scan(css, open, (c, i) => {
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      close = i;
      return true;
    }
  });
  return close;
}

/** Next `{` or `;` at this level, or -1. */
function nextBoundary(css: string, from: number): number {
  let found = -1;
  scan(css, from, (c, i) => {
    if (c === "{" || c === ";") {
      found = i;
      return true;
    }
  });
  return found;
}

const NESTED_AT_RULES = new Set(["media", "supports", "container", "layer"]);
const KEPT_AT_RULES = new Set(["font-face", "keyframes", "-webkit-keyframes"]);

function scopeBlock(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = nextBoundary(css, i);
    if (at === -1) break;
    // A statement (@import, @charset, @layer a, b;): none is needed, and
    // @import is the one that fetches.
    if (css[at] === ";") {
      i = at + 1;
      continue;
    }
    const prelude = css.slice(i, at).trim();
    const close = matchingBrace(css, at);
    const body = css.slice(at + 1, close);
    i = close + 1;
    if (!prelude) continue;
    if (prelude.startsWith("@")) {
      const name = prelude.slice(1).split(/[\s({]/)[0].toLowerCase();
      if (NESTED_AT_RULES.has(name)) out += `${prelude} {\n${scopeBlock(body)}}\n`;
      else if (KEPT_AT_RULES.has(name)) out += `${prelude} {${cleanValues(body)}}\n`;
    } else {
      out += `${scopeSelectors(prelude)} {${cleanValues(body)}}\n`;
    }
  }
  return out;
}

/** Split on top-level commas, leaving `:is(a, b)` and `[title="a,b"]` whole. */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  scan(prelude, 0, (c, i) => {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  });
  parts.push(prelude.slice(start));
  return parts.map((s) => s.trim()).filter(Boolean);
}

function scopeSelectors(prelude: string): string {
  return splitSelectors(prelude)
    .map((selector) => {
      if (selector.startsWith(SCOPE) && !/[\w-]/.test(selector[SCOPE.length] ?? "")) return selector;
      if (!ROOT.test(selector)) return `${SCOPE} ${selector}`;
      let rest = selector;
      let m: RegExpExecArray | null;
      while ((m = ROOT.exec(rest))) rest = rest.slice(m[0].length);
      return SCOPE + rest;
    })
    .join(", ");
}

const URL_FN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/gi;
const IMAGE_SET = /(?:-webkit-)?image-set\([^)]*\)/gi;

function cleanValues(body: string): string {
  return decodeEscapes(body)
    .replace(URL_FN, (match, dq?: string, sq?: string, bare?: string) =>
      (dq ?? sq ?? bare ?? "").trim().toLowerCase().startsWith("data:") ? match : "none",
    )
    .replace(IMAGE_SET, "none");
}
