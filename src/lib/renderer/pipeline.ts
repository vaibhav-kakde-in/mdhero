import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import texmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import { convertFileSrc } from "@tauri-apps/api/core";

// Register common languages
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import shell from "highlight.js/lib/languages/shell";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import ini from "highlight.js/lib/languages/ini";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("toml", ini);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("tsx", typescript);

export interface RenderResult {
  html: string;
  frontmatter: Record<string, unknown> | null;
  wordCount: number;
}

let md: MarkdownIt | null = null;
let initialized = false;

/**
 * Stamp top-level block elements with `data-source-line="N"` (0-indexed line in
 * source markdown). Used by the scroll-sync logic to map view ↔ raw ↔ editor.
 */
function addSourceLinePlugin(mdInstance: MarkdownIt) {
  mdInstance.core.ruler.push("source-line", (state) => {
    for (const token of state.tokens) {
      if (token.map && token.level === 0 && token.type.endsWith("_open")) {
        token.attrSet("data-source-line", String(token.map[0]));
      }
    }
  });
}

export async function initRenderer(): Promise<void> {
  if (initialized) return;

  md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang && lang !== "mermaid" && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch {}
      }
      try {
        return hljs.highlightAuto(str).value;
      } catch {}
      return "";
    },
  });

  md.use(texmath, {
    engine: katex,
    delimiters: "dollars",
  });

  md.use(taskLists, { enabled: false, label: true });
  md.use(anchor, {
    permalink: false,
    slugify: (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-"),
  });
  addSourceLinePlugin(md);

  initialized = true;
}

export function render(markdown: string, baseDir?: string): string {
  return renderFull(markdown, baseDir).html;
}

export function renderFull(markdown: string, baseDir?: string): RenderResult {
  if (!md) {
    // Auto-init synchronously if not yet initialized
    md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang && lang !== "mermaid" && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch {}
      }
      try {
        return hljs.highlightAuto(str).value;
      } catch {}
      return "";
    },
  });
    md.use(texmath, { engine: katex, delimiters: "dollars" });
    md.use(taskLists, { enabled: false, label: true });
    md.use(anchor, {
      permalink: false,
      slugify: (s: string) => s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
    });
    addSourceLinePlugin(md);
    initialized = true;
  }

  // Extract frontmatter
  let content = markdown;
  let frontmatter: Record<string, unknown> | null = null;
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    try {
      const data: Record<string, unknown> = {};
      fmMatch[1].split("\n").forEach((line) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let val: unknown = line.slice(colonIdx + 1).trim();
          if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
            val = val.slice(1, -1).split(",").map((s) => s.trim());
          }
          if (typeof val === "string" && ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
            val = val.slice(1, -1);
          }
          if (key) data[key] = val;
        }
      });
      if (Object.keys(data).length > 0) {
        frontmatter = data;
        content = fmMatch[2];
      }
    } catch {
      // Not valid frontmatter
    }
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const raw = md.render(content);
  let html = DOMPurify.sanitize(raw, {
    ADD_TAGS: [
      "pre", "code", "math", "mrow", "mi", "mo", "mn", "msup", "msub",
      "mfrac", "mover", "munder", "msqrt", "mtable", "mtr", "mtd",
      "annotation", "semantics", "mspace", "mtext", "mpadded",
      "svg", "path", "line", "rect", "circle", "g", "text", "defs",
      "marker", "polygon", "polyline", "foreignObject",
    ],
    ADD_ATTR: [
      "class", "style", "xmlns", "viewBox", "d", "fill", "stroke",
      "stroke-width", "transform", "x", "y", "width", "height",
      "text-anchor", "dominant-baseline", "font-size", "font-family",
      "marker-end", "id", "aria-hidden", "focusable", "role",
      "mathvariant", "encoding",
    ],
  });

  if (baseDir) {
    html = resolveRelativeImages(html, baseDir);
  }

  return { html, frontmatter, wordCount };
}

function resolveRelativeImages(html: string, baseDir: string): string {
  return html.replace(
    /(<img\s[^>]*?\bsrc=")(?!https?:\/\/|data:|blob:)([^"]+)(")/gi,
    (_match, before, src, after) => {
      const absPath = `${baseDir}/${src}`.replace(/\/\.\//g, "/");
      try {
        return `${before}${convertFileSrc(absPath)}${after}`;
      } catch {
        return `${before}${src}${after}`;
      }
    }
  );
}

export function isInitialized(): boolean {
  return initialized;
}
