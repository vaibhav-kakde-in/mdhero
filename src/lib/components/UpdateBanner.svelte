<script lang="ts">
  import { updateAvailable, updateDismissed, dismissUpdate } from "$lib/stores/updater";
  import { installUpdate, updateInstalling, updateProgress, updateError } from "$lib/stores/autoUpdate";

  async function openDownload() {
    const target = $updateAvailable?.download || $updateAvailable?.url;
    if (!target) return;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(target);
    } catch {
      window.open(target, "_blank");
    }
  }

  async function openReleaseNotes() {
    if (!$updateAvailable?.url) return;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl($updateAvailable.url);
    } catch {
      window.open($updateAvailable.url, "_blank");
    }
  }
</script>

{#if $updateAvailable && !$updateDismissed}
  <div class="banner" class:important={$updateAvailable.severity === "important"}>
    <div class="banner-icon">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v8M5 7l3 3 3-3" />
        <path d="M3 12v1h10v-1" />
      </svg>
    </div>
    <div class="banner-text">
      {#if $updateInstalling}
        <span class="banner-title">
          {#if $updateProgress >= 0}Downloading update… {$updateProgress}%{:else}Installing update…{/if}
        </span>
      {:else if $updateError}
        <span class="banner-title">Update failed</span>
        <span class="banner-notes" title={$updateError}>{$updateError}</span>
      {:else}
        <span class="banner-title">Update available — <strong>v{$updateAvailable.version}</strong></span>
        {#if $updateAvailable.notes}
          <span class="banner-notes" title={$updateAvailable.notes}>{$updateAvailable.notes}</span>
        {/if}
      {/if}
    </div>
    <div class="banner-actions">
      {#if $updateInstalling}
        <!-- progress shown in the title while installing -->
      {:else if $updateError}
        <button class="banner-btn primary" onclick={openDownload}>Download manually</button>
        <button class="banner-btn dismiss" onclick={dismissUpdate}>Later</button>
      {:else}
        {#if $updateAvailable.url}
          <button class="banner-btn link" onclick={openReleaseNotes}>Release notes</button>
        {/if}
        <button class="banner-btn primary" onclick={installUpdate}>Update now</button>
        <button class="banner-btn dismiss" onclick={dismissUpdate} title="Dismiss until next release">Later</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: #ECFEFF;
    border: 1px solid #A5F3FC;
    border-radius: 10px;
    color: #0E7490;
  }
  :global(html.dark) .banner {
    background: rgba(8, 145, 178, 0.12);
    border-color: rgba(34, 211, 238, 0.25);
    color: #67E8F9;
  }

  .banner.important {
    background: #FEF3C7;
    border-color: #FCD34D;
    color: #92400E;
  }
  :global(html.dark) .banner.important {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(251, 191, 36, 0.3);
    color: #FCD34D;
  }

  .banner-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .banner-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .banner-title {
    font-size: 12px;
    font-weight: 500;
  }

  .banner-notes {
    font-size: 11px;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .banner-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
    background: transparent;
    color: inherit;
  }

  .banner-btn.primary {
    background: #0891B2;
    color: white;
  }
  .banner-btn.primary:hover { background: #0E7490; }
  :global(html.dark) .banner-btn.primary { background: #0891B2; }
  :global(html.dark) .banner-btn.primary:hover { background: #22D3EE; color: #0C4A6E; }

  .banner-btn.link { text-decoration: underline; opacity: 0.85; }
  .banner-btn.link:hover { opacity: 1; }

  .banner-btn.dismiss { opacity: 0.7; }
  .banner-btn.dismiss:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
  :global(html.dark) .banner-btn.dismiss:hover { background: rgba(255, 255, 255, 0.08); }

  @media print {
    .banner { display: none !important; }
  }
</style>
