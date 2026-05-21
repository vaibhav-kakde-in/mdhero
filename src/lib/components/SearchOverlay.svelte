<script lang="ts">
  import { onMount } from "svelte";
  import Mark from "mark.js";

  let { visible = $bindable(false) }: { visible: boolean } = $props();

  let query = $state("");
  let currentMatch = $state(0);
  let totalMatches = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();
  let markInstance: Mark | null = null;

  function getArticle(): HTMLElement | null {
    return document.querySelector("article.prose");
  }

  function doSearch() {
    const article = getArticle();
    if (!article) return;

    if (!markInstance) {
      markInstance = new Mark(article);
    }

    markInstance.unmark({
      done: () => {
        if (!query.trim()) {
          totalMatches = 0;
          currentMatch = 0;
          return;
        }

        markInstance!.mark(query, {
          separateWordSearch: false,
          className: "mdv-search-highlight",
          done: (count) => {
            totalMatches = count;
            currentMatch = count > 0 ? 1 : 0;
            if (count > 0) scrollToMatch(0);
          },
        });
      },
    });
  }

  function scrollToMatch(index: number) {
    const marks = document.querySelectorAll("mark.mdv-search-highlight");
    if (marks.length === 0) return;
    marks.forEach((m) => m.classList.remove("mdv-search-active"));
    const target = marks[index];
    if (target) {
      target.classList.add("mdv-search-active");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function nextMatch() {
    if (totalMatches === 0) return;
    currentMatch = (currentMatch % totalMatches) + 1;
    scrollToMatch(currentMatch - 1);
  }

  function prevMatch() {
    if (totalMatches === 0) return;
    currentMatch = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    scrollToMatch(currentMatch - 1);
  }

  function close() {
    visible = false;
    query = "";
    totalMatches = 0;
    currentMatch = 0;
    markInstance?.unmark();
    markInstance = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  }

  $effect(() => {
    if (visible && inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });

  $effect(() => {
    query;
    if (visible) {
      doSearch();
    }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-bar" onkeydown={handleKeydown}>
    <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <circle cx="6" cy="6" r="4.5" /><line x1="9.5" y1="9.5" x2="13" y2="13" />
    </svg>

    <input
      bind:this={inputEl}
      bind:value={query}
      type="text"
      placeholder="Find in document..."
      class="search-input"
    />

    <span class="search-count">
      {#if totalMatches > 0}
        {currentMatch}/{totalMatches}
      {:else if query.trim()}
        0
      {/if}
    </span>

    <div class="search-nav">
      <button onclick={prevMatch} disabled={totalMatches === 0} class="search-nav-btn" title="Previous (Shift+Enter)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="2,8 6,4 10,8"/></svg>
      </button>
      <button onclick={nextMatch} disabled={totalMatches === 0} class="search-nav-btn" title="Next (Enter)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="2,4 6,8 10,4"/></svg>
      </button>
    </div>

    <button onclick={close} class="search-close" title="Close (Esc)">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>
    </button>
  </div>
{/if}

<style>
  .search-bar {
    position: fixed;
    top: 44px;
    right: 12px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 6px;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
    padding: 5px 8px;
  }

  :global(html.dark) .search-bar {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .search-icon {
    color: #aeaeb2;
    flex-shrink: 0;
  }

  .search-input {
    width: 200px;
    padding: 2px 0;
    font-size: 13px;
    background: transparent;
    border: none;
    outline: none;
    color: #1c1c1e;
  }

  :global(html.dark) .search-input {
    color: #e5e5e7;
  }

  .search-input::placeholder {
    color: #aeaeb2;
  }

  .search-count {
    font-size: 11px;
    color: #aeaeb2;
    min-width: 32px;
    text-align: center;
    flex-shrink: 0;
  }

  .search-nav {
    display: flex;
    gap: 1px;
  }

  .search-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: #636366;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.15s;
  }

  :global(html.dark) .search-nav-btn {
    color: #8e8e93;
  }

  .search-nav-btn:hover:not(:disabled) {
    background: #f2f2f7;
  }

  :global(html.dark) .search-nav-btn:hover:not(:disabled) {
    background: #3a3a3c;
  }

  .search-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .search-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: #aeaeb2;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .search-close:hover {
    background: #f2f2f7;
    color: #636366;
  }

  :global(html.dark) .search-close:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  /* Highlight styles */
  :global(mark.mdv-search-highlight) {
    background-color: #fde68a;
    color: inherit;
    padding: 1px 0;
    border-radius: 2px;
  }

  :global(html.dark mark.mdv-search-highlight) {
    background-color: #854d0e;
  }

  :global(mark.mdv-search-active) {
    background-color: #f97316 !important;
    color: white !important;
  }

  :global(html.dark mark.mdv-search-active) {
    background-color: #ea580c !important;
  }

  @media print {
    .search-bar { display: none !important; }
  }
</style>
