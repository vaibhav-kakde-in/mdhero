<script lang="ts">
  import { document as docStore } from "$lib/stores/document";
  import { t } from "$lib/i18n";

  // $t, not translate(): these run in the template, so they must re-run when
  // the language changes.
  function readingTime(words: number): string {
    const mins = Math.ceil(words / 230);
    return mins <= 1 ? $t("statusbar.minRead") : $t("statusbar.minReadN", { count: mins });
  }

  function tokenEstimate(words: number): string {
    const tokens = Math.round(words * 1.33);
    return tokens >= 1000
      ? $t("statusbar.tokensK", { count: Math.round(tokens / 100) / 10 })
      : $t("statusbar.tokens", { count: tokens });
  }
</script>

{#if $docStore.renderedHtml && $docStore.wordCount > 0}
  <footer class="status-bar">
    <span>{$t("statusbar.words", { count: $docStore.wordCount })}</span>
    <span class="sep">&middot;</span>
    <span>{readingTime($docStore.wordCount)}</span>
    <span class="sep">&middot;</span>
    <span>{tokenEstimate($docStore.wordCount)}</span>
  </footer>
{/if}

<style>
  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 16px;
    font-size: 11px;
    color: #aeaeb2;
    background: rgba(250, 250, 250, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid #e5e5ea;
  }

  :global(html.dark) .status-bar {
    background: rgba(22, 22, 24, 0.85);
    border-top-color: #2c2c2e;
    color: #636366;
  }

  .sep {
    color: #d1d1d6;
  }

  :global(html.dark) .sep {
    color: #3a3a3c;
  }

  @media print {
    .status-bar { display: none !important; }
  }
</style>
