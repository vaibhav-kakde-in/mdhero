/**
 * Quick Look preview bundle.
 *
 * Builds to a single self-contained `preview.html` that the macOS Quick Look
 * extension loads into a WKWebView. It reuses `renderer/pipeline.ts` verbatim —
 * the same markdown-it configuration, the same `html: false`, the same
 * DOMPurify pass — so the preview is not a second markdown implementation, only
 * a second host for the existing one.
 *
 * #security: this page renders a document of unknown provenance with NO Tauri
 * CSP header in reach (Tauri serves that from its asset protocol, which does not
 * exist here) and inside an extension that must hold
 * `com.apple.security.network.client` for WKWebView to load at all. The CSP in
 * the generated HTML is therefore the only egress control on this path. See
 * scripts/build-quicklook.mjs for the policy and why it is nonce-based.
 */
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { initRenderer, render } from "../lib/renderer/pipeline";
import { MERMAID_SANITIZE_CONFIG } from "../lib/renderer/mermaid-sanitize";
import "./preview.css";

function initMermaid(isDark: boolean): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    // #security: strict keeps Mermaid from emitting HTML labels or click-node
    // JS/URL bindings from untrusted diagram source. Do not relax this; see
    // CLAUDE.md's security invariants.
    securityLevel: "strict",
    // #security: render labels as SVG <text>, never as HTML inside
    // <foreignObject>. DOMPurify >= 3.4 strips HTML from foreignObject (it is
    // a known XSS vector — the same class the Mermaid disclosure was about),
    // which would otherwise leave every diagram with empty shapes. Keeping
    // labels in pure SVG means there is no HTML inside the SVG to sanitize.
    //
    // This is here BEFORE the app itself carries it: the fix lives on
    // `chore/deps-security-refresh-rebased` (5a03430) and touches only
    // MarkdownRenderer.svelte, which predates this file. Landing it here now
    // means the DOMPurify 3.4 bump cannot silently empty every diagram in the
    // Quick Look preview. tests/unit/quicklook-bundle.test.ts enforces that the
    // preview never falls behind the app on these options again.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    class: { htmlLabels: false },
    themeVariables: isDark
      ? {
          primaryColor: "#0A1E2E",
          primaryTextColor: "#e5e5e7",
          primaryBorderColor: "#0891B2",
          lineColor: "#8e8e93",
          secondaryColor: "#1c1c1e",
          tertiaryColor: "#2c2c2e",
          noteBkgColor: "#2c2c2e",
          noteTextColor: "#e5e5e7",
          actorTextColor: "#e5e5e7",
          actorLineColor: "#636366",
          signalColor: "#aeaeb2",
          signalTextColor: "#e5e5e7",
        }
      : {},
  });
}

async function renderMermaidBlocks(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>("code.language-mermaid");
  for (const block of Array.from(blocks)) {
    const pre = block.closest("pre");
    if (!pre) continue;
    const source = block.textContent ?? "";
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const { svg } = await mermaid.render(id, source);
      const container = document.createElement("div");
      container.className = "mermaid-diagram my-4 flex justify-center";
      // #security: never trust Mermaid's SVG straight into the DOM, even in
      // strict mode. Last gate before an <svg> from an untrusted document.
      container.innerHTML = DOMPurify.sanitize(svg, MERMAID_SANITIZE_CONFIG);
      pre.replaceWith(container);
    } catch {
      // Leave the code block as-is if Mermaid fails.
    }
  }
}

async function renderDocument(markdown: string, isDark: boolean): Promise<void> {
  document.documentElement.classList.toggle("dark", isDark);

  const article = document.getElementById("doc");
  if (!article) return;

  await initRenderer();
  // Already sanitized by the pipeline (html: false + DOMPurify).
  article.innerHTML = render(markdown);

  initMermaid(isDark);
  await renderMermaidBlocks(article);

  // Tells the extension the preview has actually painted, so it can release
  // Quick Look's completion handler instead of guessing at a delay. Quick Look
  // renders the view the moment that handler fires, so releasing it early is
  // what produces a blank preview.
  document.documentElement.dataset.mdheroReady = "1";
  window.webkit?.messageHandlers?.mdheroReady?.postMessage(1);
}

declare global {
  interface Window {
    __mdheroRender: (markdown: string, isDark: boolean) => Promise<void>;
    webkit?: {
      messageHandlers?: { mdheroReady?: { postMessage: (v: unknown) => void } };
    };
  }
}

window.__mdheroRender = renderDocument;
