<script lang="ts">
      import { translationSettings, TRANSLATION_TARGET_LANGUAGES } from "$lib/stores/translation";

  let targetLang = $state($translationSettings.targetLang);
  let autoTranslate = $state($translationSettings.autoTranslate);

  $effect(() => {
    translationSettings.update((s) => ({
      ...s,
      targetLang,
      autoTranslate,
    }));
  });
</script>

<div class="translation-settings">
  <label class="setting-row">
    <div class="setting-text">
      <span class="setting-label">Target language</span>
      <span class="setting-hint">Language documents are translated to (Google Translate).</span>
    </div>
    <select class="setting-select" bind:value={targetLang}>
      {#each TRANSLATION_TARGET_LANGUAGES as lang (lang.code)}
        <option value={lang.code}>{lang.label}</option>
      {/each}
    </select>
  </label>

  <label class="setting-row">
    <div class="setting-text">
      <span class="setting-label">Always translate</span>>
      <span class="setting-hint">Automatically translate opened documents when their language differs from the target language (Chrome-style).</span>
    </div>
    <input
      type="checkbox"
      bind:checked={autoTranslate}
      class="setting-switch"
    />
  </label>
</div>

<style>
  .translation-settings {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .setting-select {
    min-width: 150px;
    padding: 4px 8px;
    border: 1px solid #e5e5ea;
    border-radius: 6px;
    background: white;
    color: #1c1c1e;
    font-size: 13px;
  }
  :global(html.dark) .setting-select {
    background: #3a3a3c;
    border-color: #3a3a3c;
    color: #e5e5e7;
  }
</style>
