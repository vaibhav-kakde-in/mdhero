<script lang="ts">
  import { settings } from "$lib/stores/settings";

  let { visible = false }: { visible: boolean } = $props();
</script>

{#if visible}
  <div class="rc-panel">
    <div class="rc-arrow"></div>
    <h3 class="rc-title">Reading Preferences</h3>

    <div class="rc-group">
      <span class="rc-label">Font</span>
      <div class="rc-segmented">
        {#each ["sans", "serif", "mono"] as font}
          <button
            onclick={() => settings.update((s) => ({ ...s, fontFamily: font as "sans" | "serif" | "mono" }))}
            class="rc-seg-btn"
            class:active={$settings.fontFamily === font}
          >
            {font.charAt(0).toUpperCase() + font.slice(1)}
          </button>
        {/each}
      </div>
    </div>

    <div class="rc-group">
      <div class="rc-label-row">
        <span class="rc-label">Text size</span>
        <span class="rc-value">{$settings.fontSize}px</span>
      </div>
      <input
        type="range"
        min="14"
        max="24"
        step="1"
        value={$settings.fontSize}
        oninput={(e) => settings.update((s) => ({ ...s, fontSize: parseInt(e.currentTarget.value) }))}
        class="rc-range"
      />
    </div>

    <div class="rc-group">
      <div class="rc-label-row">
        <span class="rc-label">Line spacing</span>
        <span class="rc-value">{$settings.lineHeight.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="1.4"
        max="2.0"
        step="0.1"
        value={$settings.lineHeight}
        oninput={(e) => settings.update((s) => ({ ...s, lineHeight: parseFloat(e.currentTarget.value) }))}
        class="rc-range"
      />
    </div>

    <div class="rc-group" style="margin-bottom: 0;">
      <div class="rc-label-row">
        <span class="rc-label">Content width</span>
        <span class="rc-value">{$settings.maxWidth}px</span>
      </div>
      <input
        type="range"
        min="560"
        max="3840"
        step="80"
        value={$settings.maxWidth}
        oninput={(e) => settings.update((s) => ({ ...s, maxWidth: parseInt(e.currentTarget.value) }))}
        class="rc-range"
      />
    </div>
  </div>
{/if}

<style>
  .rc-panel {
    position: fixed;
    right: 12px;
    top: 44px;
    width: 240px;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
    z-index: 30;
    padding: 14px;
  }

  :global(html.dark) .rc-panel {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }

  .rc-arrow {
    position: absolute;
    top: -5px;
    right: 60px;
    width: 10px;
    height: 10px;
    background: white;
    border-left: 1px solid #e5e5ea;
    border-top: 1px solid #e5e5ea;
    transform: rotate(45deg);
  }

  :global(html.dark) .rc-arrow {
    background: #2c2c2e;
    border-color: #3a3a3c;
  }

  .rc-title {
    font-size: 11px;
    font-weight: 600;
    color: #aeaeb2;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px;
  }

  .rc-group {
    margin-bottom: 14px;
  }

  .rc-label {
    font-size: 12px;
    color: #636366;
  }

  :global(html.dark) .rc-label {
    color: #8e8e93;
  }

  .rc-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .rc-value {
    font-size: 11px;
    font-family: "SF Mono", monospace;
    color: #aeaeb2;
  }

  .rc-segmented {
    display: flex;
    gap: 1px;
    background: #e5e5ea;
    border-radius: 7px;
    overflow: hidden;
    margin-top: 6px;
  }

  :global(html.dark) .rc-segmented {
    background: #3a3a3c;
  }

  .rc-seg-btn {
    flex: 1;
    padding: 5px 0;
    font-size: 11px;
    font-weight: 500;
    background: #f2f2f7;
    color: #636366;
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  :global(html.dark) .rc-seg-btn {
    background: #1c1c1e;
    color: #8e8e93;
  }

  .rc-seg-btn:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .rc-seg-btn:hover {
    background: #2c2c2e;
  }

  .rc-seg-btn.active {
    background: #0891B2;
    color: white;
  }

  :global(html.dark) .rc-seg-btn.active {
    background: #0891B2;
    color: white;
  }

  .rc-range {
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #e5e5ea;
    border-radius: 2px;
    outline: none;
  }

  :global(html.dark) .rc-range {
    background: #3a3a3c;
  }

  .rc-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #0891B2;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  :global(html.dark) .rc-range::-webkit-slider-thumb {
    border-color: #2c2c2e;
  }

  @media print {
    .rc-panel { display: none !important; }
  }
</style>
