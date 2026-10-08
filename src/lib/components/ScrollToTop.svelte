<script lang="ts">
  import { onMount } from "svelte";
  import { document as docStore } from "$lib/stores/document";
  import { t } from "$lib/i18n";

  let visible = $state(false);

  onMount(() => {
    function update() {
      visible = window.scrollY > 300;
    }
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

{#if visible && $docStore.renderedHtml}
  <button class="scroll-top" onclick={scrollToTop} title={$t('scrollToTop.title')}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="4,10 8,6 12,10"/></svg>
  </button>
{/if}

<style>
  .scroll-top {
    position: fixed;
    bottom: 36px;
    right: 16px;
    z-index: 15;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    color: #636366;
    cursor: pointer;
    transition: opacity 0.2s, background 0.15s;
    opacity: 0.7;
  }

  .scroll-top:hover {
    opacity: 1;
    background: #f2f2f7;
  }

  :global(html.dark) .scroll-top {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #aeaeb2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  :global(html.dark) .scroll-top:hover {
    background: #3a3a3c;
  }

  @media print {
    .scroll-top { display: none !important; }
  }
</style>
