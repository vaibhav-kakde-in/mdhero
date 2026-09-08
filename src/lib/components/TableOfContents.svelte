<script lang="ts">
  import { tocEntries, activeHeadingId, tocVisible, setActiveHeading } from "$lib/stores/toc";
  import {
    settings,
    clampTocWidth,
    DEFAULT_TOC_WIDTH,
    MIN_TOC_WIDTH,
    MAX_TOC_WIDTH,
  } from "$lib/stores/settings";

  let dragging = $state(false);

  // Committing to the settings store on every pointermove would rewrite
  // localStorage dozens of times a second, so a drag paints straight onto the
  // CSS variable and only the released width is persisted. `--toc-w` is owned
  // by +page.svelte, which re-publishes it whenever the stored value changes.
  function paint(width: number): void {
    document.documentElement.style.setProperty("--toc-w", `${width}px`);
  }

  function startResize(event: PointerEvent): void {
    // Ignore non-primary buttons: a right-click drag would never deliver the
    // matching pointerup, leaving the sidebar stuck in resize mode.
    if (event.button !== 0) return;
    event.preventDefault();

    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = $settings.tocWidth;
    let width = startWidth;

    handle.setPointerCapture(event.pointerId);
    dragging = true;
    // Kills the .content-main padding transition (which would lag a full frame
    // behind the pointer) and stops the drag selecting the headings it crosses.
    document.documentElement.classList.add("toc-resizing");

    const move = (e: PointerEvent) => {
      width = clampTocWidth(startWidth + (e.clientX - startX));
      paint(width);
    };

    const end = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      dragging = false;
      document.documentElement.classList.remove("toc-resizing");
      settings.update((s) => ({ ...s, tocWidth: width }));
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    // A cancelled pointer (OS gesture, window losing focus mid-drag) must still
    // commit and clean up, or the resize state leaks.
    handle.addEventListener("pointercancel", end);
  }

  // Keyboard resizing: the handle is a focusable separator, so arrows nudge it
  // and Home/End jump to the bounds.
  function handleKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    let next: number;

    if (event.key === "ArrowLeft") next = $settings.tocWidth - step;
    else if (event.key === "ArrowRight") next = $settings.tocWidth + step;
    else if (event.key === "Home") next = MIN_TOC_WIDTH;
    else if (event.key === "End") next = MAX_TOC_WIDTH;
    else return;

    event.preventDefault();
    settings.update((s) => ({ ...s, tocWidth: clampTocWidth(next) }));
  }

  function resetWidth(): void {
    settings.update((s) => ({ ...s, tocWidth: DEFAULT_TOC_WIDTH }));
  }

  function scrollToHeading(id: string) {
    setActiveHeading(id);
    const el = document.getElementById(id);
    if (el) {
      const offset = 70;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function getIndent(level: number): string {
    return `${(level - 1) * 12}px`;
  }
</script>

{#if $tocVisible && $tocEntries.length > 0}
  <aside class="toc-sidebar">
    <div class="toc-header">
      <span>On this page</span>
    </div>
    <nav class="toc-nav">
      {#each $tocEntries as entry (entry.id)}
        <button
          onclick={() => scrollToHeading(entry.id)}
          class="toc-item"
          class:active={$activeHeadingId === entry.id}
          style="padding-left: calc(12px + {getIndent(entry.level)})"
        >
          {entry.text}
        </button>
      {/each}
    </nav>
  </aside>
  <!-- Fixed rather than absolutely positioned inside the aside: the sidebar is
       a scroll container, so an absolute child would scroll out of reach on a
       long table of contents.

       This is the W3C "window splitter" pattern verbatim: a focusable
       role="separator" carrying aria-value*. The two ignores below are a linter
       limitation, not a shortcut — ARIA treats a *focusable* separator as a
       widget, but the rule only knows the non-focusable kind. Hosting it on a
       <button> instead just trades these for `<button> cannot have role
       'separator'`, which is the same disagreement from the other side. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="toc-resizer"
    class:dragging
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize table of contents"
    aria-valuenow={$settings.tocWidth}
    aria-valuemin={MIN_TOC_WIDTH}
    aria-valuemax={MAX_TOC_WIDTH}
    tabindex="0"
    title="Drag to resize — double-click to reset"
    onpointerdown={startResize}
    onkeydown={handleKeydown}
    ondblclick={resetWidth}
  ></div>
{/if}

<style>
  .toc-sidebar {
    position: fixed;
    left: 0;
    top: 80px;
    bottom: 0;
    width: var(--toc-w, 240px);
    background: #fafafa;
    border-right: 1px solid #e5e5e5;
    box-shadow: 2px 0 8px rgba(0,0,0,0.04);
    overflow-y: auto;
    z-index: 14;
  }

  :global(html.dark) .toc-sidebar {
    background: #1c1c1e;
    border-right-color: #2c2c2e;
    box-shadow: 2px 0 8px rgba(0,0,0,0.2);
  }

  .toc-resizer {
    position: fixed;
    top: 80px;
    bottom: 0;
    /* Straddles the sidebar's right border so the whole edge is grabbable. */
    left: calc(var(--toc-w, 240px) - 3px);
    width: 6px;
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
    /* Must match .toc-sidebar, not exceed it: the tab bar is also z-index 15
       and the handle renders after it, so a 15 here paints the strip across
       the tab bar while the sidebar itself correctly tucks underneath. */
    z-index: 14;
  }

  .toc-resizer:focus-visible {
    outline: none;
  }

  /* The 6px box stays as the grab target — comfortably clickable — but only
     this 2px child is ever painted, so the handle reads as a hairline instead
     of a solid bar the width of the hit area. */
  .toc-resizer::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 2px;
    background: transparent;
    transition: background 0.15s;
  }

  .toc-resizer:hover::after,
  .toc-resizer:focus-visible::after,
  .toc-resizer.dragging::after {
    background: #0891B2;
  }

  :global(html.dark) .toc-resizer:hover::after,
  :global(html.dark) .toc-resizer:focus-visible::after,
  :global(html.dark) .toc-resizer.dragging::after {
    background: #22D3EE;
  }

  .toc-header {
    padding: 12px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #aeaeb2;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toc-nav {
    padding: 0 8px 16px;
  }

  .toc-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 4px 12px;
    font-size: 13px;
    color: #636366;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    line-height: 1.6;
  }

  :global(html.dark) .toc-item {
    color: #8e8e93;
  }

  .toc-item:hover {
    color: #1c1c1e;
  }

  :global(html.dark) .toc-item:hover {
    color: #e5e5e7;
  }

  .toc-item.active {
    color: #0891B2;
    border-left-color: #0891B2;
    border-left-width: 3px;
    font-weight: 500;
    background: rgba(8, 145, 178, 0.06);
    border-radius: 0 4px 4px 0;
  }

  :global(html.dark) .toc-item.active {
    color: #22D3EE;
    border-left-color: #22D3EE;
    background: rgba(34, 211, 238, 0.08);
  }

  @media print {
    .toc-sidebar,
    .toc-resizer { display: none !important; }
  }
</style>
