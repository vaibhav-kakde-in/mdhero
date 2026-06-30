<script lang="ts">
  import { onMount, tick } from "svelte";

  let {
    value,
    onChange,
    fontSize = 14,
    lineHeight = 1.6,
    maxWidth = "720px",
  }: {
    value: string;
    onChange: (newValue: string) => void;
    fontSize?: number;
    lineHeight?: number;
    maxWidth?: string;
  } = $props();

  let textareaEl: HTMLTextAreaElement | undefined = $state();

  // Local mirror so cursor doesn't jump on parent state updates
  // svelte-ignore state_referenced_locally
  let localValue = $state(value);

  // Keep local in sync if parent value changes from a different source
  // (e.g. external file reload while not editing — though unlikely while editor is mounted)
  $effect(() => {
    if (value !== localValue && document.activeElement !== textareaEl) {
      localValue = value;
    }
  });

  onMount(() => {
    tick().then(() => {
      try {
        textareaEl?.focus({ preventScroll: true });
      } catch {
        textareaEl?.focus();
      }
    });
  });

  function handleInput() {
    onChange(localValue);
  }

  function handleKeydown(e: KeyboardEvent) {
    // Tab inserts 2 spaces instead of moving focus
    if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const t = e.target as HTMLTextAreaElement;
      const start = t.selectionStart;
      const end = t.selectionEnd;
      const indent = "  ";
      const newValue = t.value.slice(0, start) + indent + t.value.slice(end);
      localValue = newValue;
      onChange(newValue);
      // Restore cursor after the inserted indent
      tick().then(() => {
        t.selectionStart = t.selectionEnd = start + indent.length;
      });
    }
  }
</script>

<div class="editor-wrap">
  <textarea
    bind:this={textareaEl}
    bind:value={localValue}
    oninput={handleInput}
    onkeydown={handleKeydown}
    class="editor"
    style="font-size: {fontSize}px; line-height: {lineHeight}; max-width: {maxWidth};"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
  ></textarea>
</div>

<style>
  .editor-wrap {
    /* Fixed positioning so the editor cannot contribute to window scroll height.
       Sits below the sticky toolbar (~37px) + tabbar (~38px) and fills the
       remaining viewport. This guarantees a single scrollbar (the textarea's). */
    position: fixed;
    top: 75px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    background: #fafafa;
    z-index: 1;
  }

  :global(html.dark) .editor-wrap {
    background: #161618;
  }

  .editor {
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 32px;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #1c1c1e;
    font-family: "SF Mono", "JetBrains Mono", "Fira Code", Menlo, monospace;
    tab-size: 2;
    -moz-tab-size: 2;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  :global(html.dark) .editor {
    color: #e5e5e7;
  }

  .editor::placeholder {
    color: #aeaeb2;
  }
</style>
