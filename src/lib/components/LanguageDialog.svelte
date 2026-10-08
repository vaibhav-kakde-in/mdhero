<script lang="ts">
  import { get } from "svelte/store";
  import { t, locale, setLocale, SUPPORTED_LOCALES, type Locale } from "$lib/i18n";

  let { visible = $bindable(false) }: { visible: boolean } = $props();

  // Choosing a language persists it (setLocale writes localStorage), so this
  // first-run dialog never shows again.
  function choose(l: Locale) {
    setLocale(l);
    visible = false;
  }

  // Dismissing without choosing keeps the auto-detected locale, but still
  // persists it so the dialog doesn't nag on every launch.
  function dismiss() {
    setLocale(get(locale));
    visible = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) dismiss();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      dismiss();
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lang-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
    <div class="lang-dialog">
      <h2 class="lang-title">{$t('languageDialog.title')}</h2>
      <div class="lang-list">
        {#each SUPPORTED_LOCALES as l (l.code)}
          <button
            class="lang-option"
            class:selected={$locale === l.code}
            onclick={() => choose(l.code)}
          >
            <span class="lang-native">{l.nativeName}</span>
            <span class="lang-english">{l.label}</span>
          </button>
        {/each}
      </div>
      <p class="lang-hint">{$t('languageDialog.hint')}</p>
    </div>
  </div>
{/if}

<style>
  .lang-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .lang-dialog {
    width: 320px;
    background: white;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  :global(html.dark) .lang-dialog {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }

  .lang-title {
    font-size: 15px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0;
    text-align: center;
  }

  :global(html.dark) .lang-title {
    color: #e5e5e7;
  }

  .lang-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lang-option {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .lang-option:hover {
    background: #f2f2f7;
  }

  :global(html.dark) .lang-option:hover {
    background: #3a3a3c;
  }

  .lang-option.selected {
    border-color: #0891B2;
    background: rgba(8, 145, 178, 0.06);
  }

  .lang-native {
    font-size: 14px;
    font-weight: 500;
    color: #1c1c1e;
  }

  :global(html.dark) .lang-native {
    color: #e5e5e7;
  }

  .lang-english {
    font-size: 11px;
    color: #8e8e93;
  }

  .lang-hint {
    font-size: 11px;
    color: #8e8e93;
    text-align: center;
    margin: 0;
    line-height: 1.4;
  }
</style>
