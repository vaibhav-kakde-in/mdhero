<script lang="ts">
  import { Pencil, Trash2, RotateCcw, ChevronDown, ChevronRight } from "@lucide/svelte";
  import {
    aiLookup,
    addProvider,
    removeProvider,
    updateProvider,
    addPrompt,
    removePrompt,
    updatePrompt,
    setDefaultProvider,
    resetToDefaults,
    validateProviderUrl,
    type Provider,
    type Prompt,
  } from "$lib/stores/aiLookup";

  // Bundled favicons for the 5 default providers. Sourced once from
  // DuckDuckGo's favicon service (icons.duckduckgo.com/ip3/...) to avoid
  // bot-detection blocks when fetching directly from Cloudflare-fronted
  // providers (Claude, Perplexity, ChatGPT all return challenge pages or
  // 403s on direct curl). Vite imports give us content-hashed URLs and
  // proper MIME types per extension; no runtime network calls.
  import chatgptIcon from "$lib/assets/favicons/chatgpt.webp";
  import claudeIcon from "$lib/assets/favicons/claude.png";
  import perplexityIcon from "$lib/assets/favicons/perplexity.png";
  import googleIcon from "$lib/assets/favicons/google.ico";
  import wikipediaIcon from "$lib/assets/favicons/wikipedia.ico";

  const DEFAULT_FAVICONS: Record<string, string> = {
    "default-chatgpt": chatgptIcon,
    "default-claude": claudeIcon,
    "default-perplexity": perplexityIcon,
    "default-google": googleIcon,
    "default-wikipedia": wikipediaIcon,
  };

  // Only one row can be edited or added at a time. Switching rows cancels.
  let editingProviderId = $state<string | null>(null);
  let addingProviderOpen = $state(false);
  let editingPromptKey = $state<string | null>(null); // `${providerId}:${promptId}`
  let addingPromptFor = $state<string | null>(null);

  // Provider edit / add form fields
  let pName = $state("");
  let pUrl = $state("");
  let pError = $state("");

  // Prompt edit / add form fields
  let prName = $state("");
  let prTemplate = $state("");
  let prError = $state("");

  // Collapse/expand state per provider. Providers with no prompts default
  // collapsed (less visual clutter); user can toggle either way.
  let manuallyToggled = $state<Set<string>>(new Set());
  let collapsed = $state<Set<string>>(new Set());

  // Track favicons that failed to load so we can swap to a letter fallback.
  let faviconErrored = $state<Set<string>>(new Set());

  function isExpanded(p: Provider): boolean {
    if (manuallyToggled.has(p.id)) return !collapsed.has(p.id);
    // Default: expanded if it has prompts, collapsed if empty
    return p.prompts.length > 0;
  }

  function toggleProvider(p: Provider) {
    manuallyToggled.add(p.id);
    if (collapsed.has(p.id)) collapsed.delete(p.id);
    else collapsed.add(p.id);
    // Force reactive update on the Set
    manuallyToggled = new Set(manuallyToggled);
    collapsed = new Set(collapsed);
  }

  function startEditProvider(p: Provider) {
    cancelAll();
    editingProviderId = p.id;
    pName = p.name;
    pUrl = p.urlTemplate;
    // Auto-expand when editing
    if (collapsed.has(p.id)) {
      collapsed.delete(p.id);
      manuallyToggled.add(p.id);
      collapsed = new Set(collapsed);
      manuallyToggled = new Set(manuallyToggled);
    }
  }

  function startAddProvider() {
    cancelAll();
    addingProviderOpen = true;
    pName = "";
    pUrl = "https://?q={prompt}";
  }

  function startEditPrompt(providerId: string, pr: Prompt) {
    cancelAll();
    editingPromptKey = `${providerId}:${pr.id}`;
    prName = pr.name;
    prTemplate = pr.template;
  }

  function startAddPrompt(providerId: string) {
    cancelAll();
    addingPromptFor = providerId;
    prName = "";
    prTemplate = "{selection}";
  }

  function cancelAll() {
    editingProviderId = null;
    addingProviderOpen = false;
    editingPromptKey = null;
    addingPromptFor = null;
    pError = "";
    prError = "";
  }

  function saveProviderForm(targetId: string | null) {
    if (!pName.trim()) {
      pError = "Name is required";
      return;
    }
    const urlError = validateProviderUrl(pUrl);
    if (urlError) {
      pError = urlError;
      return;
    }
    if (targetId) {
      updateProvider(targetId, { name: pName.trim(), urlTemplate: pUrl.trim() });
    } else {
      addProvider(pName.trim(), pUrl.trim());
    }
    cancelAll();
  }

  function savePromptForm(providerId: string, promptId: string | null) {
    if (!prName.trim()) {
      prError = "Name is required";
      return;
    }
    if (!prTemplate.trim()) {
      prError = "Template is required";
      return;
    }
    if (promptId) {
      updatePrompt(providerId, promptId, {
        name: prName.trim(),
        template: prTemplate.trim(),
      });
    } else {
      addPrompt(providerId, prName.trim(), prTemplate.trim());
    }
    cancelAll();
  }

  function handleRemoveProvider(p: Provider) {
    const msg =
      p.prompts.length > 0
        ? `Delete "${p.name}" and its ${p.prompts.length} prompt${p.prompts.length === 1 ? "" : "s"}?`
        : `Delete "${p.name}"?`;
    if (confirm(msg)) removeProvider(p.id);
  }

  function handleRemovePrompt(providerId: string, pr: Prompt) {
    if (confirm(`Delete prompt "${pr.name}"?`)) removePrompt(providerId, pr.id);
  }

  function handleResetDefaults() {
    if (confirm("Reset all providers and prompts to defaults? Your customizations will be lost.")) {
      resetToDefaults();
      cancelAll();
      manuallyToggled = new Set();
      collapsed = new Set();
      faviconErrored = new Set();
    }
  }

  // Resolve the favicon for a provider:
  // 1. The 5 default providers ship bundled icons (no runtime fetch).
  // 2. Custom providers attempt `${origin}/favicon.ico` directly. The webview
  //    sends a normal browser referrer so most sites serve the icon (the
  //    `referrerpolicy="no-referrer"` attribute is intentionally absent —
  //    omitting it tripped Cloudflare bot-detection on big providers).
  // 3. If neither works, the letter-circle fallback renders.
  function faviconUrl(p: Provider): string {
    if (DEFAULT_FAVICONS[p.id]) return DEFAULT_FAVICONS[p.id];
    try {
      const url = new URL(p.urlTemplate.replace("{prompt}", "x"));
      return `${url.origin}/favicon.ico`;
    } catch {
      return "";
    }
  }

  function onFaviconError(providerId: string) {
    faviconErrored.add(providerId);
    faviconErrored = new Set(faviconErrored);
  }
</script>

<div class="ail-root">
  {#each $aiLookup.providers as p (p.id)}
    {@const expanded = isExpanded(p)}
    {@const isEditingProvider = editingProviderId === p.id}
    <div class="provider" class:provider-collapsed={!expanded}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="provider-row" onclick={() => toggleProvider(p)}>
        <span class="chevron" aria-hidden="true">
          {#if expanded}<ChevronDown size={12} strokeWidth={2.25} />{:else}<ChevronRight size={12} strokeWidth={2.25} />{/if}
        </span>
        <span class="favicon-wrap">
          {#if faviconErrored.has(p.id) || !faviconUrl(p)}
            <span class="favicon-letter">{p.name.charAt(0).toUpperCase()}</span>
          {:else}
            <img
              class="favicon"
              src={faviconUrl(p)}
              alt=""
              onerror={() => onFaviconError(p.id)}
            />
          {/if}
        </span>
        <span class="provider-name">{p.name}</span>
        {#if p.prompts.length > 0}
          <span class="prompt-count">{p.prompts.length}</span>
        {/if}
        <div class="actions">
          <button
            class="icon-btn"
            title="Edit provider"
            aria-label="Edit provider"
            onclick={(e) => { e.stopPropagation(); startEditProvider(p); }}
          >
            <Pencil size={14} />
          </button>
          <button
            class="icon-btn icon-btn-danger"
            title="Delete provider"
            aria-label="Delete provider"
            onclick={(e) => { e.stopPropagation(); handleRemoveProvider(p); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {#if expanded}
        {#if isEditingProvider}
          <div class="edit-form provider-edit-form">
            <input class="text-input" bind:value={pName} placeholder="Provider name" />
            <input class="text-input mono" bind:value={pUrl} placeholder="https://example.com/?q={`{prompt}`}" />
            {#if pError}<div class="form-error">{pError}</div>{/if}
            <div class="form-actions">
              <button class="form-btn" onclick={cancelAll}>Cancel</button>
              <button class="form-btn form-btn-primary" onclick={() => saveProviderForm(p.id)}>Save</button>
            </div>
          </div>
        {/if}

        <div class="prompts">
          {#each p.prompts as pr (pr.id)}
            {@const isEditingThisPrompt = editingPromptKey === `${p.id}:${pr.id}`}
            {#if isEditingThisPrompt}
              <div class="edit-form prompt-edit-form">
                <input class="text-input" bind:value={prName} placeholder="Prompt name" />
                <textarea class="textarea-input" bind:value={prTemplate} rows="2" placeholder="Template — use {`{selection}`} where the text goes"></textarea>
                {#if prError}<div class="form-error">{prError}</div>{/if}
                <div class="form-actions">
                  <button class="form-btn" onclick={cancelAll}>Cancel</button>
                  <button class="form-btn form-btn-primary" onclick={() => savePromptForm(p.id, pr.id)}>Save</button>
                </div>
              </div>
            {:else}
              <div class="prompt-row" title={pr.template}>
                <span class="prompt-name">{pr.name}</span>
                <div class="actions">
                  <button
                    class="icon-btn"
                    title="Edit prompt"
                    aria-label="Edit prompt"
                    onclick={() => startEditPrompt(p.id, pr)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    class="icon-btn icon-btn-danger"
                    title="Delete prompt"
                    aria-label="Delete prompt"
                    onclick={() => handleRemovePrompt(p.id, pr)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            {/if}
          {/each}

          {#if addingPromptFor === p.id}
            <div class="edit-form prompt-edit-form">
              <input class="text-input" bind:value={prName} placeholder="Prompt name" />
              <textarea class="textarea-input" bind:value={prTemplate} rows="2" placeholder="Template — use {`{selection}`} where the text goes"></textarea>
              {#if prError}<div class="form-error">{prError}</div>{/if}
              <div class="form-actions">
                <button class="form-btn" onclick={cancelAll}>Cancel</button>
                <button class="form-btn form-btn-primary" onclick={() => savePromptForm(p.id, null)}>Add</button>
              </div>
            </div>
          {:else}
            <button class="add-prompt-btn" onclick={() => startAddPrompt(p.id)}>+ Add prompt</button>
          {/if}
        </div>
      {/if}
    </div>
  {/each}

  {#if addingProviderOpen}
    <div class="edit-form add-provider-form">
      <input class="text-input" bind:value={pName} placeholder="Provider name" />
      <input class="text-input mono" bind:value={pUrl} placeholder="https://example.com/?q={`{prompt}`}" />
      {#if pError}<div class="form-error">{pError}</div>{/if}
      <div class="form-actions">
        <button class="form-btn" onclick={cancelAll}>Cancel</button>
        <button class="form-btn form-btn-primary" onclick={() => saveProviderForm(null)}>Add</button>
      </div>
    </div>
  {:else}
    <button class="add-provider-btn" onclick={startAddProvider}>+ Add provider</button>
  {/if}

  <div class="default-row">
    <span class="default-label">Default for Custom prompt</span>
    <div class="default-right">
      {#if $aiLookup.providers.length > 0}
        <div class="select-wrap">
          <select
            class="default-select"
            value={$aiLookup.defaultProviderId}
            onchange={(e) => setDefaultProvider(e.currentTarget.value)}
          >
            {#each $aiLookup.providers as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <span class="select-chevron" aria-hidden="true">
            <ChevronDown size={12} strokeWidth={2.25} />
          </span>
        </div>
      {/if}
      <button
        class="reset-icon-btn"
        title="Reset to defaults"
        aria-label="Reset all providers and prompts to defaults"
        onclick={handleResetDefaults}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  </div>
</div>

<style>
  .ail-root {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* --- Provider card ---------------------------------------------------- */

  .provider {
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    background: transparent;
    overflow: hidden;
  }

  :global(html.dark) .provider {
    border-color: #3a3a3c;
  }

  .provider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
    user-select: none;
    transition: background 0.12s;
  }

  .provider-row:hover {
    background: #f7f7f9;
  }

  :global(html.dark) .provider-row:hover {
    background: #2a2a2c;
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #aeaeb2;
    width: 14px;
    flex-shrink: 0;
  }

  .favicon-wrap {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #f2f2f7;
  }

  :global(html.dark) .favicon-wrap {
    background: #3a3a3c;
  }

  .favicon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .favicon-letter {
    font-size: 10px;
    font-weight: 600;
    color: #636366;
    line-height: 1;
  }

  :global(html.dark) .favicon-letter {
    color: #aeaeb2;
  }

  .provider-name {
    font-size: 13px;
    font-weight: 500;
    color: #1c1c1e;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(html.dark) .provider-name {
    color: #e5e5e7;
  }

  .prompt-count {
    font-size: 11px;
    color: #aeaeb2;
    font-variant-numeric: tabular-nums;
    background: #f2f2f7;
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  :global(html.dark) .prompt-count {
    background: #3a3a3c;
    color: #aeaeb2;
  }

  /* --- Actions (pencil + trash icons) ----------------------------------- */

  .actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s;
  }

  .provider-row:hover .actions,
  .provider-row:focus-within .actions,
  .prompt-row:hover .actions,
  .prompt-row:focus-within .actions {
    opacity: 1;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 5px;
    color: #8e8e93;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }

  :global(html.dark) .icon-btn {
    color: #8e8e93;
  }

  .icon-btn:hover {
    background: #e5e5ea;
    color: #1c1c1e;
  }

  :global(html.dark) .icon-btn:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .icon-btn-danger:hover {
    background: #fee;
    color: #c44;
  }

  :global(html.dark) .icon-btn-danger:hover {
    background: #2a1414;
    color: #ff6b6b;
  }

  /* --- Prompts list ----------------------------------------------------- */

  .prompts {
    padding: 0 10px 6px 36px; /* left aligns with provider name (after chevron + favicon + gaps) */
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .prompt-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: 5px;
    cursor: default;
    transition: background 0.12s;
  }

  .prompt-row:hover {
    background: #f7f7f9;
  }

  :global(html.dark) .prompt-row:hover {
    background: #2a2a2c;
  }

  .prompt-name {
    font-size: 12.5px;
    color: #1c1c1e;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(html.dark) .prompt-name {
    color: #e5e5e7;
  }

  /* --- Add buttons ------------------------------------------------------ */

  .add-prompt-btn,
  .add-provider-btn {
    background: none;
    border: 1px dashed #d1d1d6;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: #8e8e93;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  :global(html.dark) .add-prompt-btn,
  :global(html.dark) .add-provider-btn {
    border-color: #48484a;
  }

  .add-prompt-btn {
    margin-top: 4px;
    align-self: flex-start;
  }

  .add-provider-btn {
    margin-top: 8px;
    text-align: center;
    width: 100%;
  }

  .add-prompt-btn:hover,
  .add-provider-btn:hover {
    background: #f2f2f7;
    color: #1c1c1e;
    border-color: #aeaeb2;
  }

  :global(html.dark) .add-prompt-btn:hover,
  :global(html.dark) .add-provider-btn:hover {
    background: #2c2c2e;
    color: #e5e5e7;
    border-color: #636366;
  }

  /* --- Edit forms (inline) --------------------------------------------- */

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: #f9f9fb;
    border-top: 1px solid #e5e5ea;
  }

  :global(html.dark) .edit-form {
    background: #1c1c1e;
    border-top-color: #3a3a3c;
  }

  .provider-edit-form {
    margin: 0;
  }

  .prompt-edit-form {
    border-radius: 6px;
    border: 1px solid #e5e5ea;
    border-top: 1px solid #e5e5ea;
    margin: 4px 0;
  }

  :global(html.dark) .prompt-edit-form {
    border-color: #3a3a3c;
  }

  .add-provider-form {
    border-radius: 8px;
    border: 1px solid #e5e5ea;
    margin-top: 8px;
  }

  :global(html.dark) .add-provider-form {
    border-color: #3a3a3c;
  }

  .text-input,
  .textarea-input {
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #1c1c1e;
  }

  .text-input.mono,
  .textarea-input {
    font-family: "SF Mono", monospace;
    font-size: 11px;
  }

  .textarea-input {
    resize: vertical;
  }

  :global(html.dark) .text-input,
  :global(html.dark) .textarea-input {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .text-input:focus,
  .textarea-input:focus {
    outline: none;
    border-color: #0891b2;
  }

  .form-error {
    font-size: 11px;
    color: #c44;
  }

  :global(html.dark) .form-error {
    color: #ff6b6b;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .form-btn {
    padding: 4px 12px;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 500;
    color: #1c1c1e;
    cursor: pointer;
  }

  :global(html.dark) .form-btn {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .form-btn-primary {
    background: #0891b2;
    border-color: #0891b2;
    color: white;
  }

  :global(html.dark) .form-btn-primary {
    background: #0891b2;
    border-color: #0891b2;
    color: white;
  }

  .form-btn-primary:hover {
    background: #0e7490;
    border-color: #0e7490;
  }

  /* --- Default-provider row + reset ------------------------------------ */

  .default-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 0 4px;
    border-top: 1px solid #f2f2f7;
    margin-top: 10px;
  }

  :global(html.dark) .default-row {
    border-top-color: #3a3a3c;
  }

  .default-label {
    font-size: 12px;
    color: #636366;
  }

  :global(html.dark) .default-label {
    color: #aeaeb2;
  }

  .default-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Custom-styled select to match the dark-mode dialog (avoids the native
     macOS up/down arrows that look out of place against the rest of the UI). */
  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .default-select {
    appearance: none;
    -webkit-appearance: none;
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 6px;
    padding: 5px 26px 5px 10px;
    font-size: 12px;
    font-family: inherit;
    color: #1c1c1e;
    cursor: pointer;
  }

  :global(html.dark) .default-select {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .default-select:focus {
    outline: none;
    border-color: #0891b2;
  }

  .select-chevron {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    color: #8e8e93;
    pointer-events: none;
  }

  .reset-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #8e8e93;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .reset-icon-btn:hover {
    background: #f2f2f7;
    color: #1c1c1e;
    border-color: #d1d1d6;
  }

  :global(html.dark) .reset-icon-btn:hover {
    background: #3a3a3c;
    color: #e5e5e7;
    border-color: #48484a;
  }
</style>
