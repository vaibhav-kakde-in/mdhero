<script lang="ts">
  import { updateAvailable, updateDismissed, dismissUpdate } from "$lib/stores/updater";
  import { installUpdate, updateInstalling, updateProgress, updateError } from "$lib/stores/autoUpdate";
  import { tabStore, HOME_TAB_ID } from "$lib/stores/tabs";

  const { activeTabId } = tabStore;

  async function openRelease() {
    const target = $updateAvailable?.download || $updateAvailable?.url;
    if (!target) return;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(target);
    } catch {
      window.open(target, "_blank");
    }
  }
</script>

<!-- Hide the toast on the home tab — UpdateBanner shows there instead. -->
{#if $updateAvailable && !$updateDismissed && $activeTabId !== HOME_TAB_ID}
  <div class="update-toast">
    <div class="update-content">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v8M5 7l3 3 3-3" />
        <path d="M3 12v1h10v-1" />
      </svg>
      <span class="update-text">
        {#if $updateInstalling}
          {#if $updateProgress >= 0}Downloading… {$updateProgress}%{:else}Installing…{/if}
        {:else if $updateError}
          Update failed
        {:else}
          MDHero <strong>v{$updateAvailable.version}</strong> is available
        {/if}
      </span>
    </div>
    <div class="update-actions">
      {#if $updateInstalling}
        <!-- buttons hidden while installing; progress shows in the text -->
      {:else if $updateError}
        <button class="update-btn download" onclick={openRelease}>Download manually</button>
        <button class="update-btn dismiss" onclick={dismissUpdate}>Later</button>
      {:else}
        <button class="update-btn download" onclick={installUpdate}>Update now</button>
        <button class="update-btn dismiss" onclick={dismissUpdate}>Later</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .update-toast {
    position: fixed;
    bottom: 48px;
    right: 16px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
    font-size: 12px;
    animation: slideUp 0.3s ease-out;
  }

  :global(html.dark) .update-toast {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .update-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #1c1c1e;
  }

  :global(html.dark) .update-content {
    color: #e5e5e7;
  }

  .update-content svg {
    color: #0891B2;
    flex-shrink: 0;
  }

  .update-text {
    white-space: nowrap;
  }

  .update-actions {
    display: flex;
    gap: 4px;
  }

  .update-btn {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .update-btn.download {
    background: #0891B2;
    color: white;
  }

  .update-btn.download:hover {
    background: #0E7490;
  }

  .update-btn.dismiss {
    background: transparent;
    color: #8e8e93;
  }

  .update-btn.dismiss:hover {
    background: #f2f2f7;
    color: #636366;
  }

  :global(html.dark) .update-btn.dismiss:hover {
    background: #3a3a3c;
    color: #aeaeb2;
  }

  @media print {
    .update-toast { display: none !important; }
  }
</style>
