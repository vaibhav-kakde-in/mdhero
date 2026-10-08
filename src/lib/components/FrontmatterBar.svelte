<script lang="ts">
  import { document as docStore } from "$lib/stores/document";

  function formatValue(val: unknown): string {
    if (Array.isArray(val)) return val.join(", ");
    if (val instanceof Date) return val.toLocaleDateString();
    return String(val);
  }

  function getDisplayEntries(fm: Record<string, unknown>): [string, string][] {
    return Object.entries(fm)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, 6)
      .map(([k, v]) => [k, formatValue(v)]);
  }
</script>

{#if $docStore.frontmatter}
  {@const entries = getDisplayEntries($docStore.frontmatter)}
  {#if entries.length > 0}
    <div class="fm-bar">
      {#each entries as [key, value]}
        <div class="fm-field">
          <span class="fm-key">{key}</span>
          <span class="fm-value">{value}</span>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .fm-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    max-width: 720px;
    margin: 0 auto;
    padding: 10px 32px;
    border-bottom: 1px solid #e5e5ea;
  }

  :global(html.page-dark) .fm-bar {
    border-bottom-color: #2c2c2e;
  }

  .fm-field {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .fm-key {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #aeaeb2;
  }

  .fm-value {
    font-size: 12px;
    color: #636366;
  }

  :global(html.page-dark) .fm-value {
    color: #8e8e93;
  }

  @media print {
    .fm-bar {
      border-bottom-color: #ddd;
    }
  }
</style>
