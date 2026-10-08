<script lang="ts">
  import { splitSlides } from "$lib/renderer/slides";
  import { renderFull, stripFrontmatter } from "$lib/renderer/pipeline";
  import MarkdownRenderer from "./MarkdownRenderer.svelte";
  import { t } from "$lib/i18n";

  let {
    content,
    baseDir = "",
    paginate = false,
    onExit = () => {},
    onLocalLink,
  }: {
    content: string;
    baseDir?: string;
    paginate?: boolean;
    onExit?: () => void;
    onLocalLink?: (href: string) => void;
  } = $props();

  // Split once per content change, then render each slide's HTML up front so
  // navigation is instant (decks are small; assets were already whitelisted when
  // the file opened, so no per-slide allow_assets call is needed).
  let slideHtmls = $derived(
    splitSlides(stripFrontmatter(content)).map((s) => renderFull(s, baseDir).html)
  );

  let current = $state(0);

  // Keep the index valid if the deck shrinks (e.g. after an edit).
  $effect(() => {
    if (current > slideHtmls.length - 1) current = Math.max(0, slideHtmls.length - 1);
  });

  const total = $derived(slideHtmls.length);

  function go(delta: number) {
    current = Math.min(total - 1, Math.max(0, current + delta));
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault();
        go(1);
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        go(-1);
        break;
      case "Home":
        e.preventDefault();
        current = 0;
        break;
      case "End":
        e.preventDefault();
        current = total - 1;
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        onExit();
        break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="present-root" role="presentation">
  <button class="present-close" onclick={onExit} title={$t('presentation.exitTitle')} aria-label={$t('presentation.exitAria')}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
  </button>

  <button class="nav-edge left" onclick={() => go(-1)} disabled={current === 0} aria-label={$t('presentation.prevAria')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,4 7,12 15,20"/></svg>
  </button>

  <div class="stage">
    {#key current}
      <div class="slide">
        <MarkdownRenderer html={slideHtmls[current] ?? ""} {onLocalLink} />
      </div>
    {/key}
    {#if paginate && total > 0}
      <div class="counter">{current + 1} / {total}</div>
    {/if}
  </div>

  <button class="nav-edge right" onclick={() => go(1)} disabled={current >= total - 1} aria-label={$t('presentation.nextAria')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,4 17,12 9,20"/></svg>
  </button>
</div>

<style>
  .present-root {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    background: #0e0e10;
  }

  .stage {
    position: relative;
    width: min(100%, calc((100vh - 96px) * 16 / 9));
    aspect-ratio: 16 / 9;
    background: #ffffff;
    border-radius: 10px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    display: flex;
  }

  :global(html.dark) .stage {
    background: #1c1c1e;
  }

  /* The slide scrolls internally if its content overflows the 16:9 frame. */
  .slide {
    flex: 1;
    overflow-y: auto;
    padding: 6% 8%;
  }

  /* Neutralize MarkdownRenderer's own centering/width cap inside the stage. */
  .slide :global(.md-content) {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .counter {
    position: absolute;
    right: 18px;
    bottom: 14px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: #8e8e93;
    background: rgba(0, 0, 0, 0.04);
    padding: 2px 8px;
    border-radius: 999px;
    pointer-events: none;
  }

  :global(html.dark) .counter {
    color: #aeaeb2;
    background: rgba(255, 255, 255, 0.06);
  }

  .nav-edge {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #8e8e93;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .nav-edge:hover:not(:disabled) {
    color: #f2f2f7;
    background: rgba(255, 255, 255, 0.08);
  }

  .nav-edge:disabled {
    opacity: 0.25;
    cursor: default;
  }

  .present-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #8e8e93;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .present-close:hover {
    color: #f2f2f7;
    background: rgba(255, 255, 255, 0.08);
  }
</style>
