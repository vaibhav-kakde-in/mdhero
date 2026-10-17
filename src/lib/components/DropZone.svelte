<script lang="ts">
  import { openFile } from "../tauri/files";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";

  let isDragging = $state(false);

  onMount(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          if ((window as any).__mdhero_tab_dragging) return;
          isDragging = true;
        } else if (event.payload.type === "drop") {
          isDragging = false;
          const files = event.payload.paths;
          if (files.length > 0) {
            const file = files[0];
            if (file.match(/\.(md|markdown|mdown|mkd|txt)$/i)) {
              openFile(file);
            }
          }
        } else if (event.payload.type === "leave") {
          isDragging = false;
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  });
</script>

{#if isDragging}
  <div class="dropzone">
    <div class="dropzone-content">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="20" height="24" rx="2" />
        <polyline points="12,14 16,10 20,14" />
        <line x1="16" y1="10" x2="16" y2="22" />
      </svg>
      <p class="dropzone-text">{$t('dropzone.drop')}</p>
    </div>
  </div>
{/if}

<style>
  .dropzone {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(88, 86, 214, 0.08);
    backdrop-filter: blur(2px);
    pointer-events: none;
  }

  .dropzone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 48px;
    border: 2px dashed #0891B2;
    border-radius: 16px;
    background: rgba(8, 145, 178, 0.06);
    color: #0891B2;
  }

  :global(html.dark) .dropzone-content {
    background: rgba(8, 145, 178, 0.12);
    color: #22D3EE;
    border-color: #22D3EE;
  }

  .dropzone-text {
    font-size: 15px;
    font-weight: 500;
    margin: 0;
  }
</style>
