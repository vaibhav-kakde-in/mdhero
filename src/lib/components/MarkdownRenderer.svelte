<script lang="ts">
  import { onMount, tick } from "svelte";
  import { settings, fontFamilyMap } from "$lib/stores/settings";
  import { tocEntries, activeHeadingId, extractToc, tocVisible, isObserverPaused } from "$lib/stores/toc";
  import mermaid from "mermaid";

  let {
    html = "",
    onImageClick = (_src: string, _all: string[], _idx: number) => {},
  }: {
    html: string;
    onImageClick?: (src: string, allImages: string[], index: number) => void;
  } = $props();

  let articleEl: HTMLElement | undefined = $state();
  let observer: IntersectionObserver | undefined;
  let lastMermaidTheme = "";
  let tooltipEl: HTMLDivElement | undefined;

  function initMermaid() {
    const isDark = document.documentElement.classList.contains("dark");
    const theme = isDark ? "dark" : "default";
    if (theme === lastMermaidTheme) return;
    lastMermaidTheme = theme;
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
      themeVariables: isDark ? {
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
      } : {},
    });
  }

  async function renderMermaidBlocks() {
    if (!articleEl) return;
    const blocks = articleEl.querySelectorAll("code.language-mermaid");
    if (blocks.length === 0) return;

    initMermaid();

    for (const block of blocks) {
      const pre = block.parentElement;
      if (!pre || pre.tagName !== "PRE") continue;
      if (pre.dataset.mermaidRendered) continue;

      const source = block.textContent ?? "";
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

      try {
        const { svg } = await mermaid.render(id, source);
        const container = document.createElement("div");
        container.className = "mermaid-diagram my-4 flex justify-center";
        container.innerHTML = svg;
        pre.replaceWith(container);
      } catch {
        // Leave the code block as-is if Mermaid fails
        pre.dataset.mermaidRendered = "failed";
      }
    }
  }

  function setupTocObserver() {
    if (!articleEl) return;
    if (observer) observer.disconnect();

    const headings = articleEl.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
    if (headings.length === 0) return;

    observer = new IntersectionObserver(
      (entries) => {
        if (isObserverPaused()) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeHeadingId.set(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer!.observe(h));
  }

  onMount(() => {
    return () => {
      observer?.disconnect();
    };
  });

  $effect(() => {
    // Re-run when html changes
    html;

    tick().then(() => {
      if (!articleEl) return;

      // Extract TOC entries
      const entries = extractToc(articleEl);
      tocEntries.set(entries);

      // Set up intersection observer for active heading
      setupTocObserver();

      // Add copy buttons to code blocks
      addCodeCopyButtons();

      // Add image click handlers for lightbox
      addImageClickHandlers();

      // Add link hover tooltips
      addLinkTooltips();

      // Open external links in system browser
      addExternalLinkHandlers();

      // Render Mermaid diagrams
      renderMermaidBlocks();
    });
  });

  function addImageClickHandlers() {
    if (!articleEl) return;
    const imgs = articleEl.querySelectorAll("img");
    const allSrcs = Array.from(imgs).map((img) => img.src).filter(Boolean);

    imgs.forEach((img, idx) => {
      if (img.dataset.lightboxBound) return;
      img.dataset.lightboxBound = "true";
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => {
        onImageClick(img.src, allSrcs, idx);
      });
    });
  }

  function addLinkTooltips() {
    if (!articleEl) return;

    // Create tooltip element once
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "link-tooltip";
      document.body.appendChild(tooltipEl);
    }

    const links = articleEl.querySelectorAll("a[href]");
    links.forEach((link) => {
      if ((link as HTMLElement).dataset.tooltipBound) return;
      (link as HTMLElement).dataset.tooltipBound = "true";

      link.addEventListener("mouseenter", (e) => {
        const href = link.getAttribute("href") ?? "";
        if (!href || href.startsWith("#")) return;
        tooltipEl!.textContent = href;
        tooltipEl!.style.display = "block";
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        tooltipEl!.style.left = `${rect.left}px`;
        tooltipEl!.style.top = `${rect.bottom + 4}px`;
      });

      link.addEventListener("mouseleave", () => {
        tooltipEl!.style.display = "none";
      });
    });
  }

  function addExternalLinkHandlers() {
    if (!articleEl) return;
    const links = articleEl.querySelectorAll("a[href]");
    links.forEach((link) => {
      if ((link as HTMLElement).dataset.externalBound) return;
      const href = link.getAttribute("href") ?? "";
      // Skip anchor links (in-page navigation)
      if (!href || href.startsWith("#")) return;
      (link as HTMLElement).dataset.externalBound = "true";
      link.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(href);
        } catch {
          window.open(href, "_blank");
        }
      });
    });
  }

  function addCodeCopyButtons() {
    if (!articleEl) return;
    const pres = articleEl.querySelectorAll("pre");

    for (const pre of pres) {
      if (pre.querySelector(".code-copy-btn")) continue;
      if (pre.dataset.mermaidRendered) continue;

      // Make pre relative for absolute positioning of the button
      pre.style.position = "relative";

      const btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code?.textContent ?? pre.textContent ?? "";
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy"), 1500);
        });
      });

      pre.appendChild(btn);
    }
  }
</script>

<article
  bind:this={articleEl}
  class="md-content prose prose-slate dark:prose-invert max-w-none mx-auto px-8 py-8 transition-all"
  class:toc-offset={$tocVisible && $tocEntries.length > 0}
  style="
    max-width: {$settings.maxWidth}px;
    font-size: {$settings.fontSize}px;
    line-height: {$settings.lineHeight};
    font-family: {fontFamilyMap[$settings.fontFamily]};
  "
>
  {@html html}
</article>

<style>
  .md-content {
    color: #1c1c1e;
  }

  :global(html.dark) .md-content {
    color: #d1d1d6;
    background: transparent;
  }

  /* Override any Tailwind prose white backgrounds in dark mode */
  :global(html.dark) article.prose {
    --tw-prose-body: #d1d1d6;
    --tw-prose-headings: #f2f2f7;
    --tw-prose-bold: #e5e5e7;
    --tw-prose-counters: #8e8e93;
    --tw-prose-bullets: #636366;
    --tw-prose-quotes: #8e8e93;
    --tw-prose-code: #67E8F9;
    --tw-prose-pre-bg: #1c1c1e;
    --tw-prose-th-borders: #3a3a3c;
    --tw-prose-td-borders: #2c2c2e;
  }

  .toc-offset {
    margin-left: 240px;
  }

  /* Typography refinement */
  article :global(h1) {
    font-size: 1.75em;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-top: 1.5em;
    color: #1c1c1e;
  }

  :global(html.dark) article :global(h1) {
    color: #f2f2f7;
  }

  article :global(h2) {
    font-size: 1.4em;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #1c1c1e;
  }

  :global(html.dark) article :global(h2) {
    color: #e5e5e7;
  }

  article :global(h3) {
    font-size: 1.15em;
    font-weight: 600;
    color: #1c1c1e;
  }

  :global(html.dark) article :global(h3) {
    color: #e5e5e7;
  }

  /* Code */
  article :global(pre) {
    border-radius: 10px;
    padding: 1em 1.2em;
    overflow-x: auto;
    font-size: 0.8em;
    border: 1px solid #e5e5ea;
    background: #f6f8fa !important;
    color: #24292f !important;
  }

  :global(html.dark) article :global(pre) {
    border-color: #2c2c2e;
  }

  article :global(code) {
    font-family: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, monospace;
  }

  article :global(:not(pre) > code) {
    background: #f2f2f7;
    padding: 0.15em 0.4em;
    border-radius: 5px;
    font-size: 0.85em;
    color: #0E7490;
  }

  :global(html.dark) article :global(:not(pre) > code) {
    background: #2c2c2e;
    color: #67E8F9;
  }

  /* Strip the literal backticks @tailwindcss/typography adds around inline
     code via ::before/::after — every other markdown renderer omits them. */
  article :global(:not(pre) > code)::before,
  article :global(:not(pre) > code)::after {
    content: none;
  }

  /* Tables */
  article :global(table) {
    border-collapse: collapse;
    width: 100%;
    overflow-x: auto;
    display: block;
    font-size: 0.9em;
  }

  article :global(th),
  article :global(td) {
    border: 1px solid #e5e5ea;
    padding: 0.5em 0.75em;
    text-align: left;
  }

  :global(html.dark) article :global(th),
  :global(html.dark) article :global(td) {
    border-color: #3a3a3c;
  }

  article :global(th) {
    background: #f2f2f7;
    font-weight: 600;
    font-size: 0.9em;
    color: #636366;
  }

  :global(html.dark) article :global(th) {
    background: #1c1c1e;
    color: #aeaeb2;
  }

  /* Blockquotes */
  article :global(blockquote) {
    border-left: 3px solid #0891B2;
    padding-left: 1em;
    margin-left: 0;
    color: #636366;
  }

  :global(html.dark) article :global(blockquote) {
    border-left-color: rgba(8, 145, 178, 0.6);
    color: #8e8e93;
  }

  /* Images */
  article :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }

  /* Horizontal rules */
  article :global(hr) {
    border: none;
    border-top: 1px solid #e5e5ea;
    margin: 2em 0;
  }

  :global(html.dark) article :global(hr) {
    border-top-color: #2c2c2e;
  }

  /* Task lists */
  article :global(.task-list-item) {
    list-style: none;
    margin-left: -1.5em;
  }

  article :global(.task-list-item input[type="checkbox"]) {
    margin-right: 0.5em;
    accent-color: #0891B2;
  }

  /* Links */
  article :global(a) {
    color: #0891B2;
    text-decoration: none;
  }

  article :global(a:hover) {
    text-decoration: underline;
  }

  :global(html.dark) article :global(a) {
    color: #22D3EE;
  }

  /* Code copy button */
  article :global(.code-copy-btn) {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 500;
    font-family: -apple-system, sans-serif;
    color: #8e8e93;
    background: rgba(255,255,255,0.8);
    border: 1px solid #e5e5ea;
    border-radius: 5px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    z-index: 2;
    backdrop-filter: blur(4px);
  }

  :global(html.dark) article :global(.code-copy-btn) {
    background: rgba(44,44,46,0.8);
    border-color: #3a3a3c;
    color: #aeaeb2;
  }

  article :global(pre:hover .code-copy-btn) {
    opacity: 1;
  }

  article :global(.code-copy-btn:hover) {
    background: rgba(255,255,255,0.95);
    color: #1c1c1e;
  }

  :global(html.dark) article :global(.code-copy-btn:hover) {
    background: rgba(58,58,60,0.95);
    color: #e5e5e7;
  }

  /* Link tooltip */
  :global(.link-tooltip) {
    display: none;
    position: fixed;
    z-index: 50;
    max-width: 400px;
    padding: 4px 8px;
    font-size: 11px;
    font-family: "SF Mono", monospace;
    color: #636366;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  :global(html.dark .link-tooltip) {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #aeaeb2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  /* Code block dark mode override for highlight.js */
  :global(html.dark) article :global(pre) {
    background: #0d1117 !important;
    color: #e6edf3 !important;
  }

  :global(html.dark) article :global(.hljs-keyword) { color: #ff7b72 !important; }
  :global(html.dark) article :global(.hljs-string) { color: #a5d6ff !important; }
  :global(html.dark) article :global(.hljs-comment) { color: #8b949e !important; }
  :global(html.dark) article :global(.hljs-number) { color: #79c0ff !important; }
  :global(html.dark) article :global(.hljs-function) { color: #d2a8ff !important; }
  :global(html.dark) article :global(.hljs-title) { color: #d2a8ff !important; }
  :global(html.dark) article :global(.hljs-built_in) { color: #ffa657 !important; }
  :global(html.dark) article :global(.hljs-type) { color: #ffa657 !important; }
  :global(html.dark) article :global(.hljs-attr) { color: #79c0ff !important; }
  :global(html.dark) article :global(.hljs-variable) { color: #ffa657 !important; }
  :global(html.dark) article :global(.hljs-params) { color: #e6edf3 !important; }
  :global(html.dark) article :global(.hljs-meta) { color: #79c0ff !important; }
  :global(html.dark) article :global(.hljs-addition) { color: #aff5b4 !important; background: rgba(46,160,67,0.15) !important; }
  :global(html.dark) article :global(.hljs-deletion) { color: #ffdcd7 !important; background: rgba(248,81,73,0.15) !important; }

  /* Mermaid */
  article :global(.mermaid-diagram) {
    overflow-x: auto;
  }

  article :global(.mermaid-diagram svg) {
    max-width: 100%;
    height: auto;
  }


  /* KaTeX */
  article :global(.katex-display) {
    overflow-x: auto;
    padding: 0.5em 0;
  }

  article :global(.katex) {
    font-size: 1.1em;
  }
</style>
