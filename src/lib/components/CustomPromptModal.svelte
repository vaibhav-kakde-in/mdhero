<script lang="ts">
  import { tick } from "svelte";
  import { aiLookup, assembleUrl, type Provider } from "$lib/stores/aiLookup";

  let {
    visible = $bindable(false),
    selection = "",
  }: { visible: boolean; selection?: string } = $props();

  let promptText = $state("");
  let providerId = $state("");
  let error = $state("");
  let sending = $state(false);
  let promptEl: HTMLTextAreaElement | undefined = $state();

  const providers = $derived($aiLookup.providers);
  const defaultProviderId = $derived($aiLookup.defaultProviderId);
  const selectedProvider = $derived<Provider | undefined>(
    providers.find((p) => p.id === providerId),
  );
  const hasSelection = $derived(selection.trim().length > 0);
  const canSend = $derived(
    !!selectedProvider && promptText.trim().length > 0 && !sending,
  );

  // When the modal opens, reset transient state and focus the textarea. We
  // intentionally keep `promptText` blank each time — saved templates exist for
  // the "remember this wrapper" case; this modal is for ad-hoc prompts.
  $effect(() => {
    if (visible) {
      promptText = "";
      providerId = defaultProviderId || providers[0]?.id || "";
      error = "";
      sending = false;
      tick().then(() => promptEl?.focus());
    }
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) visible = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      visible = false;
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    if (!canSend || !selectedProvider) return;
    sending = true;
    error = "";

    // Compose final prompt: user's wrapper + selection if present.
    // The provider's URL template has `{prompt}` (validated on save); the
    // composed string gets URL-encoded into that slot by assembleUrl.
    const composed = hasSelection ? `${promptText}\n\n${selection}` : promptText;

    try {
      // Reuse the provider's URL template with a synthetic prompt template
      // that's just the composed string. assembleUrl substitutes {selection}
      // first (no-op here, since composed has no token) then URL-encodes
      // into {prompt}.
      const url = assembleUrl(selectedProvider.urlTemplate, composed, "");
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      visible = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to open URL";
      sending = false;
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="dialog">
      <div class="dialog-header">
        <h2 class="dialog-title">Custom AI Prompt</h2>
        <button onclick={() => (visible = false)} class="dialog-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        {#if hasSelection}
          <div class="field">
            <div class="field-label">Selected text</div>
            <div class="selection-box" aria-readonly="true">{selection}</div>
          </div>
        {:else}
          <p class="no-selection-hint">No selection — your prompt will be sent as-is.</p>
        {/if}

        <div class="field">
          <label class="field-label" for="custom-prompt-text">
            Your prompt
            {#if hasSelection}<span class="field-hint">(the selection above will be appended)</span>{/if}
          </label>
          <textarea
            id="custom-prompt-text"
            bind:this={promptEl}
            bind:value={promptText}
            placeholder={hasSelection
              ? "Give me a concise background on this company:"
              : "Type your prompt…"}
            class="prompt-input"
            rows="4"
          ></textarea>
        </div>

        <div class="field field-row">
          <label class="field-label" for="custom-prompt-provider">Provider</label>
          {#if providers.length === 0}
            <div class="no-providers">No providers configured — add one in Settings.</div>
          {:else}
            <select
              id="custom-prompt-provider"
              bind:value={providerId}
              class="provider-select"
            >
              {#each providers as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          {/if}
        </div>

        {#if error}
          <div class="error">{error}</div>
        {/if}
      </div>

      <div class="dialog-footer">
        <button onclick={() => (visible = false)} class="btn btn-secondary">
          Cancel
        </button>
        <button onclick={handleSend} disabled={!canSend} class="btn btn-primary">
          {sending ? "Opening…" : "Send →"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .dialog {
    width: 520px;
    max-height: 80vh;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(html.dark) .dialog {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #f2f2f7;
  }

  :global(html.dark) .dialog-header {
    border-bottom-color: #3a3a3c;
  }

  .dialog-title {
    font-size: 15px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0;
  }

  :global(html.dark) .dialog-title {
    color: #e5e5e7;
  }

  .dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    color: #aeaeb2;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
  }

  .dialog-close:hover {
    background: #f2f2f7;
    color: #636366;
  }

  :global(html.dark) .dialog-close:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .dialog-body {
    padding: 14px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-row {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: #636366;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  :global(html.dark) .field-label {
    color: #aeaeb2;
  }

  .field-hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #aeaeb2;
    margin-left: 6px;
  }

  .selection-box {
    background: #f2f2f7;
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #1c1c1e;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(html.dark) .selection-box {
    background: #1c1c1e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .no-selection-hint {
    font-size: 12px;
    color: #8e8e93;
    margin: 0;
    padding: 6px 0;
  }

  .prompt-input {
    width: 100%;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #1c1c1e;
    font-family: inherit;
    resize: vertical;
    line-height: 1.45;
  }

  :global(html.dark) .prompt-input {
    background: #1c1c1e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .prompt-input:focus {
    outline: none;
    border-color: #0891b2;
  }

  .provider-select {
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 13px;
    color: #1c1c1e;
    font-family: inherit;
  }

  :global(html.dark) .provider-select {
    background: #1c1c1e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .no-providers {
    font-size: 12px;
    color: #c44;
  }

  :global(html.dark) .no-providers {
    color: #ff6b6b;
  }

  .error {
    font-size: 12px;
    color: #c44;
    padding: 6px 10px;
    background: #fef2f2;
    border-radius: 6px;
  }

  :global(html.dark) .error {
    color: #ff6b6b;
    background: #2a1414;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #f2f2f7;
  }

  :global(html.dark) .dialog-footer {
    border-top-color: #3a3a3c;
  }

  .btn {
    padding: 6px 14px;
    border: none;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, opacity 0.12s;
  }

  .btn-secondary {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .btn-secondary {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .btn-secondary:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .btn-secondary:hover {
    background: #48484a;
  }

  .btn-primary {
    background: #0891b2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0e7490;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
