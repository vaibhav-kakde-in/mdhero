<script lang="ts">
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

  function startEditProvider(p: Provider) {
    cancelAll();
    editingProviderId = p.id;
    pName = p.name;
    pUrl = p.urlTemplate;
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
    }
  }
</script>

<div class="ail-root">
  {#each $aiLookup.providers as p (p.id)}
    <div class="provider">
      <div class="provider-head">
        <h4 class="provider-name">{p.name}</h4>
        <div class="row-actions">
          <button class="row-btn" onclick={() => startEditProvider(p)} aria-label="Edit provider">Edit</button>
          <button class="row-btn row-btn-danger" onclick={() => handleRemoveProvider(p)} aria-label="Delete provider">Delete</button>
        </div>
      </div>

      {#if editingProviderId === p.id}
        <div class="edit-form">
          <input class="text-input" bind:value={pName} placeholder="Provider name" />
          <input class="text-input" bind:value={pUrl} placeholder="https://example.com/?q={`{prompt}`}" />
          {#if pError}<div class="form-error">{pError}</div>{/if}
          <div class="form-actions">
            <button class="form-btn" onclick={cancelAll}>Cancel</button>
            <button class="form-btn form-btn-primary" onclick={() => saveProviderForm(p.id)}>Save</button>
          </div>
        </div>
      {:else}
        <div class="provider-url" title="URL template">{p.urlTemplate}</div>
      {/if}

      <div class="prompts">
        {#each p.prompts as pr (pr.id)}
          {@const isEditing = editingPromptKey === `${p.id}:${pr.id}`}
          <div class="prompt">
            {#if isEditing}
              <div class="edit-form prompt-edit">
                <input class="text-input" bind:value={prName} placeholder="Prompt name" />
                <textarea class="textarea-input" bind:value={prTemplate} rows="2" placeholder="Template — use {`{selection}`} where the text goes"></textarea>
                {#if prError}<div class="form-error">{prError}</div>{/if}
                <div class="form-actions">
                  <button class="form-btn" onclick={cancelAll}>Cancel</button>
                  <button class="form-btn form-btn-primary" onclick={() => savePromptForm(p.id, pr.id)}>Save</button>
                </div>
              </div>
            {:else}
              <div class="prompt-head">
                <span class="prompt-name">{pr.name}</span>
                <div class="row-actions">
                  <button class="row-btn" onclick={() => startEditPrompt(p.id, pr)}>Edit</button>
                  <button class="row-btn row-btn-danger" onclick={() => handleRemovePrompt(p.id, pr)}>Delete</button>
                </div>
              </div>
              <div class="prompt-template" title="Prompt template">{pr.template}</div>
            {/if}
          </div>
        {/each}

        {#if addingPromptFor === p.id}
          <div class="edit-form prompt-edit">
            <input class="text-input" bind:value={prName} placeholder="Prompt name" />
            <textarea class="textarea-input" bind:value={prTemplate} rows="2" placeholder="Template — use {`{selection}`} where the text goes"></textarea>
            {#if prError}<div class="form-error">{prError}</div>{/if}
            <div class="form-actions">
              <button class="form-btn" onclick={cancelAll}>Cancel</button>
              <button class="form-btn form-btn-primary" onclick={() => savePromptForm(p.id, null)}>Add</button>
            </div>
          </div>
        {:else}
          <button class="add-btn" onclick={() => startAddPrompt(p.id)}>+ Add prompt</button>
        {/if}
      </div>
    </div>
  {/each}

  {#if addingProviderOpen}
    <div class="edit-form">
      <input class="text-input" bind:value={pName} placeholder="Provider name" />
      <input class="text-input" bind:value={pUrl} placeholder="https://example.com/?q={`{prompt}`}" />
      {#if pError}<div class="form-error">{pError}</div>{/if}
      <div class="form-actions">
        <button class="form-btn" onclick={cancelAll}>Cancel</button>
        <button class="form-btn form-btn-primary" onclick={() => saveProviderForm(null)}>Add</button>
      </div>
    </div>
  {:else}
    <button class="add-btn add-btn-block" onclick={startAddProvider}>+ Add provider</button>
  {/if}

  {#if $aiLookup.providers.length > 0}
    <div class="default-row">
      <span class="default-label">Default provider for Custom prompt</span>
      <select
        class="default-select"
        value={$aiLookup.defaultProviderId}
        onchange={(e) => setDefaultProvider(e.currentTarget.value)}
      >
        {#each $aiLookup.providers as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  <button class="reset-btn" onclick={handleResetDefaults}>Reset to defaults</button>
</div>

<style>
  .ail-root {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .provider {
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    padding: 10px 12px;
  }

  :global(html.dark) .provider {
    border-color: #3a3a3c;
  }

  .provider-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .provider-name {
    font-size: 13px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0;
  }

  :global(html.dark) .provider-name {
    color: #e5e5e7;
  }

  .provider-url {
    font-family: "SF Mono", monospace;
    font-size: 11px;
    color: #8e8e93;
    word-break: break-all;
    margin-bottom: 8px;
  }

  .row-actions {
    display: flex;
    gap: 4px;
  }

  .row-btn {
    background: none;
    border: none;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    color: #636366;
    cursor: pointer;
    transition: background 0.12s;
  }

  :global(html.dark) .row-btn {
    color: #aeaeb2;
  }

  .row-btn:hover {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .row-btn:hover {
    background: #3a3a3c;
    color: #e5e5e7;
  }

  .row-btn-danger:hover {
    background: #fee;
    color: #c44;
  }

  :global(html.dark) .row-btn-danger:hover {
    background: #2a1414;
    color: #ff6b6b;
  }

  .prompts {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 8px;
    border-left: 2px solid #f2f2f7;
    margin-left: 2px;
  }

  :global(html.dark) .prompts {
    border-left-color: #3a3a3c;
  }

  .prompt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .prompt-name {
    font-size: 12px;
    font-weight: 500;
    color: #1c1c1e;
  }

  :global(html.dark) .prompt-name {
    color: #e5e5e7;
  }

  .prompt-template {
    font-family: "SF Mono", monospace;
    font-size: 11px;
    color: #8e8e93;
    word-break: break-word;
    line-height: 1.4;
  }

  .add-btn {
    background: none;
    border: 1px dashed #d1d1d6;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: #636366;
    cursor: pointer;
    margin-top: 2px;
    align-self: flex-start;
    transition: background 0.12s, color 0.12s;
  }

  :global(html.dark) .add-btn {
    border-color: #48484a;
    color: #aeaeb2;
  }

  .add-btn:hover {
    background: #f2f2f7;
    color: #1c1c1e;
  }

  :global(html.dark) .add-btn:hover {
    background: #2c2c2e;
    color: #e5e5e7;
  }

  .add-btn-block {
    align-self: stretch;
    text-align: center;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
    padding: 8px;
    background: #f9f9fb;
    border-radius: 6px;
  }

  :global(html.dark) .edit-form {
    background: #1c1c1e;
  }

  .prompt-edit {
    margin-top: 0;
  }

  .text-input,
  .textarea-input {
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #1c1c1e;
  }

  .textarea-input {
    font-family: "SF Mono", monospace;
    font-size: 11px;
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
    padding: 4px 10px;
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

  .default-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0 4px;
    border-top: 1px solid #f2f2f7;
    margin-top: 8px;
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

  .default-select {
    background: white;
    border: 1px solid #d1d1d6;
    border-radius: 5px;
    padding: 4px 8px;
    font-size: 12px;
    color: #1c1c1e;
    font-family: inherit;
  }

  :global(html.dark) .default-select {
    background: #2c2c2e;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }

  .reset-btn {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 4px 0;
    font-size: 11px;
    color: #c44;
    cursor: pointer;
    text-decoration: underline;
  }

  :global(html.dark) .reset-btn {
    color: #ff6b6b;
  }
</style>
