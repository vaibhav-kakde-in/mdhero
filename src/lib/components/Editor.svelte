<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { searchQuery, searchActiveIndex, searchTotal } from "$lib/stores/search";
  import { findMatches, buildHighlightHtml } from "$lib/utils/text-search";
  import { gutterHtml as buildGutterHtml, gutterWidth as buildGutterWidth, lineCount as countLines } from "$lib/utils/line-gutter";

  let {
    value,
    onChange,
    fontSize = 14,
    lineHeight = 1.6,
    maxWidth = "720px",
    showLineNumbers = false,
    split = false,
  }: {
    value: string;
    onChange: (newValue: string) => void;
    fontSize?: number;
    lineHeight?: number;
    maxWidth?: string;
    showLineNumbers?: boolean;
    split?: boolean;
  } = $props();

  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let backdropEl: HTMLDivElement | undefined = $state();
  let gutterEl: HTMLDivElement | undefined = $state();

  // Local mirror so cursor doesn't jump on parent state updates
  // svelte-ignore state_referenced_locally
  let localValue = $state(value);

  // Keep local in sync if parent value changes from a different source
  // (e.g. external file reload while not editing — though unlikely while editor is mounted)
  $effect(() => {
    if (value !== localValue && document.activeElement !== textareaEl) {
      localValue = value;
    }
  });

  // Line-number gutter. Rendered as a third transparent mirror that wraps
  // identically to the textarea (same font, width, padding), so each logical
  // line's block has the same height as in the textarea and its number — a CSS
  // counter on the block — lines up with the block's top, even when the line
  // soft-wraps to several rows (continuation rows get no number, like a
  // wrapping code editor). No JS height measuring needed. The raw view (#110)
  // shares the same helpers.
  const lineCount = $derived(countLines(localValue));
  const gutterWidth = $derived(buildGutterWidth(lineCount));

  // --- Find-in-editor highlight backdrop --------------------------------------
  // mark.js can't highlight a <textarea> (its contents aren't markable DOM text),
  // so the find overlay's edit-mode path mirrors the text into an aria-hidden
  // backdrop sitting exactly behind the transparent textarea and paints <mark>s
  // there. The textarea's opaque text renders on top of the (transparent)
  // backdrop text, so only the match backgrounds show through.
  const matches = $derived(findMatches(localValue, $searchQuery));
  // Mirror the text with an appended trailing newline so the pre-wrap backdrop
  // reserves the same final line a <textarea> always keeps. Without it the
  // backdrop is ~1 line shorter, so near the document bottom its scrollTop
  // clamps to a smaller max and the highlights drift ~1 line below the text.
  // `matches` are computed on the un-suffixed `localValue`, so the extra newline
  // sits past every match and can't shift any offset.
  const highlightHtml = $derived(
    $searchQuery ? buildHighlightHtml(localValue + "\n", matches, $searchActiveIndex) : ""
  );

  // Publish the match count so the overlay's "n/total" counter and its
  // Enter / prev / next navigation work while editing.
  $effect(() => {
    searchTotal.set($searchQuery ? matches.length : 0);
  });

  function syncBackdropScroll() {
    if (backdropEl && textareaEl) {
      backdropEl.scrollTop = textareaEl.scrollTop;
      backdropEl.scrollLeft = textareaEl.scrollLeft;
    }
    if (gutterEl && textareaEl) {
      gutterEl.scrollTop = textareaEl.scrollTop;
    }
  }

  // Scroll the active match into view whenever it changes (next/prev/new search).
  $effect(() => {
    const idx = $searchActiveIndex;
    if (!$searchQuery || matches.length === 0) return;
    // Defer until the backdrop has rendered the new active <mark>.
    requestAnimationFrame(() => {
      const ta = textareaEl;
      const mark = backdropEl?.querySelector<HTMLElement>(`mark[data-match-index="${idx}"]`);
      if (!ta || !mark) return;
      const target = mark.offsetTop - ta.clientHeight / 2;
      ta.scrollTop = Math.max(0, target);
      syncBackdropScroll();
    });
  });

  onMount(() => {
    tick().then(() => {
      try {
        textareaEl?.focus({ preventScroll: true });
      } catch {
        textareaEl?.focus();
      }
    });
  });

  onDestroy(() => {
    // Don't leave a stale match count behind when leaving edit mode.
    searchTotal.set(0);
  });

  // Which logical line the caret is on, for the current-line highlight. Read
  // from selectionStart on every caret move (input, click, arrow keys, focus).
  let activeLine = $state(0);

  // Rebuilt on each caret move so the active line can be marked. O(lines) per
  // keystroke — fine for typical docs; switch to a single positioned highlight
  // bar if it ever lags on very large files.
  const gutterHtml = $derived(showLineNumbers ? buildGutterHtml(localValue, activeLine) : "");
  function updateActiveLine() {
    if (!textareaEl) return;
    activeLine = localValue.slice(0, textareaEl.selectionStart).split("\n").length - 1;
  }

  function handleInput() {
    onChange(localValue);
    updateActiveLine();
    syncBackdropScroll();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Tab inserts 2 spaces instead of moving focus
    if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const t = e.target as HTMLTextAreaElement;
      const start = t.selectionStart;
      const end = t.selectionEnd;
      const indent = "  ";
      const newValue = t.value.slice(0, start) + indent + t.value.slice(end);
      localValue = newValue;
      onChange(newValue);
      // Restore cursor after the inserted indent
      tick().then(() => {
        t.selectionStart = t.selectionEnd = start + indent.length;
      });
    }
  }
</script>

<div class="editor-wrap" class:split>
  <div class="editor-stack" class:with-gutter={showLineNumbers} style="max-width: {maxWidth}; --gutter-w: {gutterWidth};">
    {#if showLineNumbers}
      <!-- Line-number gutter: a transparent mirror wrapping identically to the
           textarea; CSS counters on each line block render the numbers. -->
      <div
        bind:this={gutterEl}
        class="editor-gutter"
        aria-hidden="true"
        style="font-size: {fontSize}px; line-height: {lineHeight};"
      >{@html gutterHtml}</div>
    {/if}
    <!-- Highlight layer: mirrors the textarea text so search matches can be
         painted behind the transparent textarea. -->
    <div
      bind:this={backdropEl}
      class="editor-backdrop"
      class:with-gutter={showLineNumbers}
      aria-hidden="true"
      style="font-size: {fontSize}px; line-height: {lineHeight};"
    >{@html highlightHtml}</div>
    <textarea
      bind:this={textareaEl}
      bind:value={localValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onkeyup={updateActiveLine}
      onclick={updateActiveLine}
      onfocus={updateActiveLine}
      onscroll={syncBackdropScroll}
      class="editor"
      class:with-gutter={showLineNumbers}
      style="font-size: {fontSize}px; line-height: {lineHeight};"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
    ></textarea>
  </div>
</div>

<style>
  .editor-wrap {
    /* Fixed positioning so the editor cannot contribute to window scroll height.
       Sits below the sticky toolbar (~37px) + tabbar (~38px) and fills the
       remaining viewport. This guarantees a single scrollbar (the textarea's). */
    position: fixed;
    top: 75px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    background: #fafafa;
    z-index: 1;
  }

  :global(html.dark) .editor-wrap {
    background: #161618;
  }

  /* Split mode (#19): editor occupies the left half; the preview pane (in
     +page) fills the right half. A divider marks the seam. */
  .editor-wrap.split {
    right: 50%;
    border-right: 1px solid #e5e5e5;
  }

  :global(html.dark) .editor-wrap.split {
    border-right-color: #2c2c2e;
  }

  .editor-stack {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
  }

  /* The textarea, the highlight backdrop, and the line-number gutter MUST share
     identical text metrics and box sizing so their wrapped lines line up. */
  .editor,
  .editor-backdrop,
  .editor-gutter {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 32px;
    border: none;
    font-family: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, monospace;
    tab-size: 2;
    -moz-tab-size: 2;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
    /* Both layers MUST reserve an identical scrollbar gutter, otherwise their
       lines wrap at different widths. The textarea is the scroll container, so
       when its vertical scrollbar appears it shrinks the text width by the
       scrollbar's size; the backdrop (no scrollbar) would keep the full width,
       so its lines wrap later and the highlights drift up by one row per
       differently-wrapped line, accumulating down the document. Forcing
       `overflow-y: scroll` on BOTH always reserves the same gutter (zero with
       macOS overlay scrollbars, ~15px with classic ones), keeping them in sync. */
    overflow-x: hidden;
    overflow-y: scroll;
  }

  .editor {
    background: transparent;
    outline: none;
    resize: none;
    color: #1c1c1e;
    z-index: 1;
  }

  :global(html.dark) .editor {
    color: #e5e5e7;
  }

  .editor::placeholder {
    color: #aeaeb2;
  }

  .editor-backdrop {
    color: transparent;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  /* With the gutter on, both text layers shift right by the gutter width so
     their text starts after the numbers and still wraps at a matching width. */
  .editor.with-gutter,
  .editor-backdrop.with-gutter {
    padding-left: calc(32px + var(--gutter-w));
  }

  /* Line-number gutter. Transparent full-width text mirror (so line blocks wrap
     to the same heights as the textarea); the number is a CSS counter drawn in
     the left strip. overflow:hidden + JS scrollTop sync keeps it aligned.
     ponytail: exact on macOS overlay scrollbars (0px); on classic scrollbars the
     textarea reserves a ~15px gutter this layer doesn't, so long wrapped lines
     can drift — same known trade-off the search backdrop documents above. */
  .editor-gutter {
    padding-left: calc(32px + var(--gutter-w));
    color: transparent;
    pointer-events: none;
    user-select: none;
    overflow: hidden;
    z-index: 0;
    counter-reset: gl;
  }

  .editor-gutter :global(.gl) {
    counter-increment: gl;
    position: relative;
  }

  .editor-gutter :global(.gl)::before {
    content: counter(gl);
    position: absolute;
    left: calc(-1 * var(--gutter-w));
    width: calc(var(--gutter-w) - 8px);
    text-align: right;
    color: #b0b0b5;
  }

  :global(html.dark) .editor-gutter :global(.gl)::before {
    color: #5a5a5e;
  }

  /* Current line: full-width subtle highlight + a brighter, higher-contrast
     number, the way a code editor marks the caret's line. */
  .editor-gutter :global(.gl.active) {
    background: rgba(0, 0, 0, 0.035);
  }

  :global(html.dark) .editor-gutter :global(.gl.active) {
    background: rgba(255, 255, 255, 0.045);
  }

  .editor-gutter :global(.gl.active)::before {
    color: #3f3f46;
    font-weight: 500;
  }

  :global(html.dark) .editor-gutter :global(.gl.active)::before {
    color: #c8c8cd;
  }

  /* Gutter column: a faint tint + hairline divider separating the numbers from
     the text. Static (doesn't scroll), painted behind the numbers. */
  .editor-stack.with-gutter::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: calc(32px + var(--gutter-w) - 4px);
    border-right: 1px solid rgba(0, 0, 0, 0.06);
    background: rgba(0, 0, 0, 0.015);
    z-index: 0;
    pointer-events: none;
  }

  :global(html.dark) .editor-stack.with-gutter::before {
    border-right-color: rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
  }

  /* In the backdrop only the <mark> backgrounds should be visible; the real,
     opaque textarea text sits on top, so keep the mark text transparent. */
  .editor-backdrop :global(mark.mdv-search-highlight) {
    color: transparent;
    background-color: #fde68a;
    border-radius: 2px;
  }

  :global(html.dark) .editor-backdrop :global(mark.mdv-search-highlight) {
    background-color: #854d0e;
  }

  .editor-backdrop :global(mark.mdv-search-active) {
    color: transparent !important;
    background-color: #f97316 !important;
  }

  :global(html.dark) .editor-backdrop :global(mark.mdv-search-active) {
    background-color: #ea580c !important;
  }
</style>
