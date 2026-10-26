<script lang="ts">
  import { Copy, Trash2, FolderOpen, Upload, TriangleAlert } from "@lucide/svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { t, translate } from "$lib/i18n";
  import { BUILTIN_TEMPLATES, templateLabel, type DocTemplate } from "$lib/templates";
  import { allTemplates, refreshUserTemplates } from "$lib/stores/userTemplates";
  import { showToast } from "$lib/stores/toast";
  import {
    createUserTemplate,
    deleteUserTemplate,
    importTemplateCss,
    openTemplatesFolder,
  } from "$lib/tauri/templates";

  function isReplacement(tpl: DocTemplate): boolean {
    return !tpl.builtin && BUILTIN_TEMPLATES.some((b) => b.id === tpl.id);
  }

  function fail(e: unknown) {
    showToast(typeof e === "string" ? e : translate("templateSettings.failed"));
  }

  async function duplicate(tpl: DocTemplate) {
    const name = translate("templateSettings.copyName", { name: templateLabel(tpl, translate) });
    const json = JSON.stringify({ name, margin: tpl.margin }, null, 2) + "\n";
    try {
      const id = await createUserTemplate(`${tpl.id}-copy`, json, tpl.css);
      await refreshUserTemplates();
      showToast(translate("templateSettings.created", { id }));
    } catch (e) {
      fail(e);
    }
  }

  async function remove(tpl: DocTemplate) {
    if (!confirm(translate("templateSettings.deleteConfirm", { name: templateLabel(tpl, translate) }))) return;
    try {
      await deleteUserTemplate(tpl.id);
      await refreshUserTemplates();
    } catch (e) {
      fail(e);
    }
  }

  async function importCss() {
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: "CSS", extensions: ["css"] }],
      });
      if (typeof picked !== "string") return;
      const id = await importTemplateCss(picked);
      await refreshUserTemplates();
      showToast(translate("templateSettings.created", { id }));
    } catch (e) {
      fail(e);
    }
  }
</script>

<ul class="tpl-list">
  {#each $allTemplates as tpl (tpl.id)}
    <li class="tpl-row">
      <div class="tpl-text">
        <span class="tpl-name">{templateLabel(tpl, $t)}</span>
        <span class="tpl-meta">
          <code>template: {tpl.id}</code>
          · {tpl.builtin ? $t('templateSettings.builtin') : isReplacement(tpl) ? $t('templateSettings.replacesBuiltin') : $t('templateSettings.yours')}
        </span>
        {#if tpl.error}
          <span class="tpl-error"><TriangleAlert size={12} /> {$t('templateSettings.refused', { reason: tpl.error })}</span>
        {/if}
      </div>
      <div class="tpl-actions">
        <button class="icon-btn" title={$t('templateSettings.duplicate')} aria-label={$t('templateSettings.duplicate')} disabled={!!tpl.error} onclick={() => duplicate(tpl)}>
          <Copy size={14} />
        </button>
        {#if !tpl.builtin}
          <button class="icon-btn icon-btn-danger" title={$t('templateSettings.delete')} aria-label={$t('templateSettings.delete')} onclick={() => remove(tpl)}>
            <Trash2 size={14} />
          </button>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<div class="tpl-footer">
  <button class="tpl-btn" onclick={() => openTemplatesFolder().catch(fail)}>
    <FolderOpen size={14} /> {$t('templateSettings.openFolder')}
  </button>
  <button class="tpl-btn" onclick={importCss}>
    <Upload size={14} /> {$t('templateSettings.importCss')}
  </button>
</div>

<style>
  .tpl-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tpl-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid #f2f2f7;
  }

  :global(html.dark) .tpl-row {
    border-bottom-color: #3a3a3c;
  }

  .tpl-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tpl-name {
    font-size: 13px;
    color: #1c1c1e;
  }

  :global(html.dark) .tpl-name {
    color: #e5e5e7;
  }

  .tpl-meta {
    font-size: 11px;
    color: #8e8e93;
  }

  .tpl-error {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #c44;
  }

  :global(html.dark) .tpl-error {
    color: #ff6b6b;
  }

  .tpl-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
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

  .tpl-footer {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .tpl-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: #1c1c1e;
    background: #f2f2f7;
    border: 1px solid #e5e5ea;
    border-radius: 6px;
    cursor: pointer;
  }

  .tpl-btn:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .tpl-btn {
    color: #e5e5e7;
    background: #3a3a3c;
    border-color: #48484a;
  }

  :global(html.dark) .tpl-btn:hover {
    background: #48484a;
  }
</style>
