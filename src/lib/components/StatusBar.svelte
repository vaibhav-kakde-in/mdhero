<script lang="ts">
  import { document as docStore } from "$lib/stores/document";
  import { t, locale, type Translator } from "$lib/i18n";

  function readingTime(words: number, t: Translator): string {
    return t("status.readingTime", { mins: Math.max(Math.ceil(words / 230), 1) });
  }

  function tokenEstimate(words: number, t: Translator): string {
    const tokens = Math.round(words * 1.33);
    return tokens >= 1000
      ? t("status.tokensK", { tokens: (tokens / 1000).toFixed(1) })
      : t("status.tokens", { tokens });
  }
</script>

{#if $docStore.renderedHtml && $docStore.wordCount > 0}
  <footer class="status-bar">
    <span>{$t("status.words", { count: $docStore.wordCount.toLocaleString($locale === "zh" ? "zh-CN" : "en-US") })}</span>
    <span class="sep">&middot;</span>
    <span>{readingTime($docStore.wordCount, $t)}</span>
    <span class="sep">&middot;</span>
    <span>{tokenEstimate($docStore.wordCount, $t)}</span>
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
