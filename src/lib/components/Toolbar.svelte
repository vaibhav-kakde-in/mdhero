<script lang="ts">
  import { document } from "../stores/document";
  import { themeMode, cycleTheme } from "../stores/theme";
  import { tocVisible, tocEntries, toggleToc, activeHeadingId } from "../stores/toc";
  import { openFileDialog } from "../tauri/files";
  import { copyAsRichText, copyAsMarkdown } from "../utils/clipboard";
  import ReaderControls from "./ReaderControls.svelte";

  let {
    onPaste = () => {},
    onOpen = () => {},
    onUrl = () => {},
    rawMode = false,
    onRawToggle = () => {},
    isEditing = false,
    dirty = false,
    canEdit = false,
    onEditToggle = () => {},
    onSave = () => {},
    onOpenSettings = () => {},
  }: {
    onPaste?: () => void;
    onOpen?: () => void;
    onUrl?: () => void;
    rawMode?: boolean;
    onRawToggle?: () => void;
    isEditing?: boolean;
    dirty?: boolean;
    canEdit?: boolean;
    onEditToggle?: () => void;
    onSave?: () => void;
    onOpenSettings?: () => void;
  } = $props();

  let currentHeading = $derived(
    $activeHeadingId && $tocEntries.length > 0
      ? $tocEntries.find((e) => e.id === $activeHeadingId)?.text ?? null
      : null
  );

  let showReaderControls = $state(false);
  let showCopyMenu = $state(false);
  let copyFeedback = $state("");

  function closeAll() {
    showReaderControls = false;
    showCopyMenu = false;
  }

  function toggleReaderControls() {
    const next = !showReaderControls;
    closeAll();
    showReaderControls = next;
  }

  function toggleCopyMenu() {
    const next = !showCopyMenu;
    closeAll();
    showCopyMenu = next;
  }

  function handleThemeToggle() {
    closeAll();
    themeMode.update((m) => cycleTheme(m));
  }

  async function handleExportPdf() {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      await getCurrentWebview().print();
    } catch {
      window.print();
    }
  }

  async function handleCopyRichText() {
    const article = globalThis.document?.querySelector("article.prose");
    if (!article || !$document.content) return;
    const success = await copyAsRichText(article.innerHTML, $document.content);
    copyFeedback = success ? "Copied!" : "Failed";
    showCopyMenu = false;
    setTimeout(() => (copyFeedback = ""), 1500);
  }

  async function handleCopyMarkdown() {
    if (!$document.content) return;
    const success = await copyAsMarkdown($document.content);
    copyFeedback = success ? "Copied!" : "Failed";
    showCopyMenu = false;
    setTimeout(() => (copyFeedback = ""), 1500);
  }

  function getThemeIcon(mode: string): string {
    switch (mode) {
      case "light": return "\u2600";
      case "dark": return "\u263E";
      default: return "\u25D1";
    }
  }
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <div class="btn-group">
      <button onclick={onOpen} class="btn btn-primary" title="Open file (Cmd+O)">
        Open
      </button>
      <button onclick={onPaste} class="btn btn-ghost" title="Paste markdown (Cmd+Shift+V)">
        Paste
      </button>
      <button onclick={onUrl} class="btn btn-ghost" title="Open URL">
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5.5"/><ellipse cx="7" cy="7" rx="2.5" ry="5.5"/><line x1="1.5" y1="7" x2="12.5" y2="7"/></svg>
      </button>
    </div>

    {#if $document.fileName}
      <span class="filename">{$document.fileName}</span>
      {#if currentHeading}
        <span class="heading-sep">/</span>
        <span class="current-heading">{currentHeading}</span>
      {/if}
    {/if}
  </div>

  <div class="toolbar-right">
    <button
      onclick={toggleToc}
      class="btn btn-icon"
      class:active={$tocVisible}
      disabled={!$document.renderedHtml || $tocEntries.length === 0 || isEditing}
      title={!$document.renderedHtml
        ? 'Table of Contents (open a file first)'
        : isEditing
        ? 'Table of Contents (exit edit mode to use)'
        : $tocEntries.length === 0
        ? 'Table of Contents (no headings in this document)'
        : 'Table of Contents'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="12" x2="12" y2="12"/></svg>
    </button>

    <button
      onclick={toggleReaderControls}
      class="btn btn-icon"
      class:active={showReaderControls}
      disabled={!$document.renderedHtml}
      title={$document.renderedHtml ? 'Reading preferences (Aa)' : 'Reading preferences (open a file first)'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><text x="1" y="12" font-size="12" font-weight="700" stroke="none" fill="currentColor" font-family="-apple-system, BlinkMacSystemFont, sans-serif">Aa</text></svg>
    </button>

    <button
      onclick={onRawToggle}
      class="btn btn-icon"
      class:active={rawMode}
      disabled={!$document.renderedHtml || isEditing}
      title={!$document.renderedHtml
        ? 'View raw markdown (open a file first)'
        : isEditing
        ? 'View raw markdown (exit edit mode to use)'
        : 'View raw markdown (Cmd+U)'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6,5 2,8 6,11"/>
        <polyline points="10,5 14,8 10,11"/>
        <line x1="9" y1="3" x2="7" y2="13"/>
      </svg>
    </button>

    <button
      onclick={onEditToggle}
      class="btn btn-icon"
      class:active={isEditing}
      disabled={!$document.renderedHtml || !canEdit}
      title={!$document.renderedHtml
        ? 'Edit (open a file first)'
        : !canEdit
        ? 'Edit (only available for local files)'
        : isEditing
        ? 'Exit edit mode (Cmd+E)'
        : 'Edit (Cmd+E)'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"/>
        <path d="M10 4l2 2"/>
      </svg>
    </button>

    <button
      onclick={onSave}
      class="btn btn-icon save-btn"
      class:dirty
      disabled={!dirty}
      title={dirty ? 'Save unsaved changes (Cmd+S)' : 'Save (no changes to save)'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3h8l2 2v8H3z"/>
        <path d="M5 3v4h6V3"/>
        <rect x="5" y="9" width="6" height="4"/>
      </svg>
      {#if dirty}
        <span class="dirty-dot"></span>
      {/if}
    </button>

    <div class="relative">
      <button
        onclick={toggleCopyMenu}
        class="btn btn-icon"
        disabled={!$document.renderedHtml || isEditing}
        title={!$document.renderedHtml
          ? 'Copy content (open a file first)'
          : isEditing
          ? 'Copy content (exit edit mode to use)'
          : 'Copy content'}
      >
        {#if copyFeedback}
          <span style="font-size:11px">{copyFeedback}</span>
        {:else}
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3h8"/></svg>
        {/if}
      </button>

      {#if showCopyMenu}
        <div class="dropdown">
          <button onclick={handleCopyRichText} class="dropdown-item">
            <span>Rich Text</span>
            <span class="dropdown-hint">for Docs / Notion</span>
          </button>
          <button onclick={handleCopyMarkdown} class="dropdown-item">
            <span>Markdown</span>
            <span class="dropdown-hint">raw source</span>
          </button>
        </div>
      {/if}
    </div>

    <button
      onclick={handleExportPdf}
      class="btn btn-icon"
      disabled={!$document.renderedHtml || isEditing}
      title={!$document.renderedHtml
        ? 'Export PDF (open a file first)'
        : isEditing
        ? 'Export PDF (exit edit mode to use)'
        : 'Export PDF'}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 2h6l3 3v9H4z"/>
        <path d="M10 2v3h3"/>
        <polyline points="6,9 8,11 10,9"/>
        <line x1="8" y1="7" x2="8" y2="11"/>
      </svg>
    </button>

    <div class="separator"></div>

    <button
      onclick={() => { closeAll(); onOpenSettings(); }}
      class="btn btn-icon"
      title="Settings (Cmd+,)"
      aria-label="Settings"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>

    <button onclick={handleThemeToggle} class="btn btn-icon" title="Toggle theme">
      {getThemeIcon($themeMode)}
    </button>
  </div>
</header>

{#if showCopyMenu || showReaderControls}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[9]" onclick={closeAll} onkeydown={() => {}}></div>
{/if}

<ReaderControls visible={showReaderControls} />

<style>
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(250, 250, 250, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid #e5e5e5;
  }

  :global(html.dark) .toolbar {
    background: rgba(22, 22, 24, 0.85);
    border-bottom-color: #2c2c2e;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .btn-group {
    display: flex;
    gap: 1px;
    background: #e5e5e5;
    border-radius: 7px;
    overflow: hidden;
  }

  :global(html.dark) .btn-group {
    background: #2c2c2e;
  }

  .btn {
    font-size: 12px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn-primary {
    padding: 5px 14px;
    background: #0891B2;
    color: white;
    border-radius: 0;
  }

  .btn-primary:hover {
    background: #0E7490;
  }

  .btn-ghost {
    padding: 5px 14px;
    background: #f2f2f7;
    color: #3a3a3c;
  }

  :global(html.dark) .btn-ghost {
    background: #1c1c1e;
    color: #aeaeb2;
  }

  .btn-ghost:hover {
    background: #e5e5ea;
  }

  :global(html.dark) .btn-ghost:hover {
    background: #2c2c2e;
  }

  .btn-icon {
    padding: 5px 10px;
    background: transparent;
    color: #1c1c1e;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  :global(html.dark) .btn-icon {
    color: #e5e5e7;
  }

  .btn-icon:hover:not(:disabled):not(.active) {
    background: #f2f2f7;
    color: #000000;
  }

  :global(html.dark) .btn-icon:hover:not(:disabled):not(.active) {
    background: #2c2c2e;
    color: #ffffff;
  }

  .btn-icon.active:hover:not(:disabled) {
    background: #d4eef3;
  }

  :global(html.dark) .btn-icon.active:hover:not(:disabled) {
    background: #14304a;
  }

  .btn-icon:disabled {
    opacity: 0.22;
    cursor: not-allowed;
  }

  :global(html.dark) .btn-icon:disabled {
    opacity: 0.28;
  }

  .btn-icon.active {
    background: #E5F5F8;
    color: #0891B2;
  }

  :global(html.dark) .btn-icon.active {
    background: #0A1E2E;
    color: #22D3EE;
  }

  .filename {
    font-size: 12px;
    color: #8e8e93;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .heading-sep {
    font-size: 11px;
    color: #d1d1d6;
    margin: 0 2px;
  }

  :global(html.dark) .heading-sep {
    color: #3a3a3c;
  }

  .current-heading {
    font-size: 11px;
    color: #aeaeb2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .separator {
    width: 1px;
    height: 18px;
    background: #d1d1d6;
    margin: 0 4px;
  }

  :global(html.dark) .separator {
    background: #3a3a3c;
  }

  .dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    width: 200px;
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
    z-index: 50;
    padding: 4px;
    overflow: hidden;
  }

  :global(html.dark) .dropdown {
    background: #2c2c2e;
    border-color: #3a3a3c;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    color: #1c1c1e;
    background: none;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
  }

  :global(html.dark) .dropdown-item {
    color: #e5e5e7;
  }

  .dropdown-item:hover {
    background: #f2f2f7;
  }

  :global(html.dark) .dropdown-item:hover {
    background: #3a3a3c;
  }

  .dropdown-hint {
    font-size: 11px;
    color: #aeaeb2;
  }

  .save-btn {
    position: relative;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .save-btn.dirty {
    color: #0891B2;
  }

  :global(html.dark) .save-btn.dirty {
    color: #22D3EE;
  }

  .dirty-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #0891B2;
  }

  :global(html.dark) .dirty-dot {
    background: #22D3EE;
  }

  @media print {
    .toolbar { display: none !important; }
  }
</style>
