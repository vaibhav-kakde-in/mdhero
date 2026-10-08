<script lang="ts">
  import { onDestroy, untrack } from "svelte";

  // The drag handle on the right edge of a fixed left panel: the table of
  // contents (#108) and the side tabs panel. The panel's width lives in a CSS
  // variable that its owner publishes from the settings store.

  let {
    width,
    min,
    defaultWidth,
    clampWidth,
    maxWidth,
    cssVar,
    resizingClass,
    label,
    left,
    top,
    bottom = "0",
    zIndex = 14,
    onCommit,
  }: {
    /** The committed width, from the settings store. */
    width: number;
    min: number;
    defaultWidth: number;
    /** Clamps a width against the bounds in force right now. */
    clampWidth: (value: number) => number;
    /** The widest the panel may be right now. */
    maxWidth: () => number;
    /** The CSS variable the panel and the layout read the width from. */
    cssVar: string;
    /** Class set on <html> while a drag is in flight. */
    resizingClass: string;
    label: string;
    /** CSS `left` of the handle, which straddles the panel's right border. */
    left: string;
    top: string;
    /** CSS `bottom` of the handle, for a panel that stops short of the window. */
    bottom?: string;
    /** Must match the panel's own, not exceed it: a higher one paints the
     *  handle across anything the panel correctly tucks underneath. */
    zIndex?: number;
    onCommit: (width: number) => void;
  } = $props();

  let dragging = $state(false);
  /** Width being painted right now, or null when not dragging. Kept in state so
   *  aria-valuenow can report what the separator is actually at: the store is
   *  deliberately not written until the gesture ends. */
  let liveWidth = $state<number | null>(null);
  /** Detaches the listeners of the gesture in flight. Held at component scope
   *  so unmounting mid-drag can run it — the handle disappears with the
   *  component, so its own pointerup never arrives. */
  let detach: (() => void) | null = null;
  /** Mirrors the ceiling in force, which shrinks with the window, so
   *  aria-valuemax reports it. */
  let ceiling = $state(untrack(() => maxWidth()));

  // Committing to the settings store on every pointermove would rewrite
  // localStorage dozens of times a second, so a gesture paints straight onto
  // the CSS variable and only the final width is persisted.
  function paint(value: number): void {
    document.documentElement.style.setProperty(cssVar, `${value}px`);
  }

  /** Ends whatever gesture is in flight. Safe to call when none is.
   *
   *  Order matters: the listeners and the global class come off FIRST, so a
   *  throw anywhere later cannot leave the resizing class applied — that class
   *  sets `user-select: none` on the root element, so leaking it makes nothing
   *  in the app selectable until restart. */
  function endGesture(commit: boolean): void {
    if (!detach) return;
    detach();
    detach = null;
    dragging = false;
    document.documentElement.classList.remove(resizingClass);

    const value = liveWidth;
    liveWidth = null;
    if (commit && value !== null) {
      onCommit(value);
    } else {
      paint(width);
    }
  }

  function startResize(event: PointerEvent): void {
    // Ignore non-primary buttons: a right-click drag would never deliver the
    // matching pointerup, leaving the panel stuck in resize mode.
    if (event.button !== 0) return;
    // preventDefault suppresses the compatibility mousedown, and with it the
    // default focus action — so focus the handle explicitly, or the advertised
    // "focus it and use the arrows" path is only reachable by tabbing.
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.focus();

    endGesture(false); // defensive: never stack two gestures

    const startX = event.clientX;
    const startWidth = width;
    liveWidth = startWidth;
    ceiling = maxWidth();

    handle.setPointerCapture(event.pointerId);
    dragging = true;
    // Kills the document's padding transition (which would lag a full frame
    // behind the pointer) and stops the drag selecting the text it crosses.
    document.documentElement.classList.add(resizingClass);

    const move = (e: PointerEvent) => {
      liveWidth = clampWidth(startWidth + (e.clientX - startX));
      paint(liveWidth);
    };
    const finish = () => endGesture(true);

    detach = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      // Last, and guarded. releasePointerCapture is specified to throw
      // NotFoundError when the pointer is no longer active, which is exactly
      // the pointercancel case; capture is released implicitly anyway, so this
      // is belt-and-braces and must never be able to abort the cleanup above.
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer already gone — nothing to release */
      }
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    // A cancelled pointer (OS gesture, window losing focus mid-drag) must still
    // commit and clean up, or the resize state leaks.
    handle.addEventListener("pointercancel", finish);
  }

  // Keyboard resizing: the handle is a focusable separator, so arrows nudge it
  // and Home/End jump to the bounds. Held keys paint only and commit on keyup —
  // committing per repeat would do a synchronous localStorage write per OS key
  // repeat, the exact cost the drag path is written to avoid.
  function handleKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    const current = liveWidth ?? width;
    let next: number;

    if (event.key === "ArrowLeft") next = current - step;
    else if (event.key === "ArrowRight") next = current + step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = maxWidth();
    else return;

    event.preventDefault();
    liveWidth = clampWidth(next);
    paint(liveWidth);
  }

  function handleKeyup(): void {
    if (liveWidth === null) return;
    const value = liveWidth;
    liveWidth = null;
    onCommit(value);
  }

  function resetWidth(): void {
    liveWidth = null;
    onCommit(defaultWidth);
  }

  // Narrowing the window must pull an over-wide panel back in, or it covers
  // the document with its handle off-screen and no pointer route back. The
  // listener reads the props untracked so it is attached once instead of on
  // every width change.
  $effect(() => {
    const onResize = () =>
      untrack(() => {
        ceiling = maxWidth();
        const fitted = clampWidth(width);
        if (fitted !== width) onCommit(fitted);
      });
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  });

  // Unmounting mid-drag (Cmd+T, Cmd+W, entering zen or edit mode, moving the
  // tabs) takes the handle out of the DOM, so its pointerup never fires and
  // endGesture would never run. Without this the global class — and its
  // app-wide `user-select: none` — survives the component.
  onDestroy(() => endGesture(true));
</script>

<!-- Fixed rather than absolutely positioned inside the panel: the panel is a
     scroll container, so an absolute child would scroll out of reach on a long
     list.

     This is the W3C "window splitter" pattern verbatim: a focusable
     role="separator" carrying aria-value*. The two ignores below are a linter
     limitation, not a shortcut — ARIA treats a *focusable* separator as a
     widget, but the rule only knows the non-focusable kind. Hosting it on a
     <button> instead just trades these for `<button> cannot have role
     'separator'`, which is the same disagreement from the other side. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="panel-resizer"
  class:dragging
  style="left: {left}; top: {top}; bottom: {bottom}; z-index: {zIndex};"
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={liveWidth ?? width}
  aria-valuemin={min}
  aria-valuemax={ceiling}
  tabindex="0"
  title="Drag to resize — double-click to reset"
  onpointerdown={startResize}
  onkeydown={handleKeydown}
  onkeyup={handleKeyup}
  onblur={handleKeyup}
  ondblclick={resetWidth}
></div>

<style>
  .panel-resizer {
    position: fixed;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
  }

  .panel-resizer:focus-visible {
    outline: none;
  }

  /* The 6px box stays as the grab target — comfortably clickable — but only
     this 2px child is ever painted, so the handle reads as a hairline instead
     of a solid bar the width of the hit area. */
  .panel-resizer::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 2px;
    background: transparent;
    transition: background 0.15s;
  }

  .panel-resizer:hover::after,
  .panel-resizer:focus-visible::after,
  .panel-resizer.dragging::after {
    background: #0891B2;
  }

  :global(html.dark) .panel-resizer:hover::after,
  :global(html.dark) .panel-resizer:focus-visible::after,
  :global(html.dark) .panel-resizer.dragging::after {
    background: #22D3EE;
  }

  @media print {
    .panel-resizer { display: none !important; }
  }
</style>
