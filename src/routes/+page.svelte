<script lang="ts">
  import { onMount, tick } from "svelte";
  import { document as docStore } from "$lib/stores/document";
  import { tabStore, HOME_TAB_ID, type Tab } from "$lib/stores/tabs";
  import { initRenderer, renderFull } from "$lib/renderer/pipeline";
  import { openFile, openFileDialog, saveFile } from "$lib/tauri/files";
  import { settings } from "$lib/stores/settings";
  import { startFileWatcher } from "$lib/tauri/watcher";
  import { themeMode, cycleTheme } from "$lib/stores/theme";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { invoke } from "@tauri-apps/api/core";
  import { tocVisible, tocEntries } from "$lib/stores/toc";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import MarkdownRenderer from "$lib/components/MarkdownRenderer.svelte";
  import DropZone from "$lib/components/DropZone.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import TableOfContents from "$lib/components/TableOfContents.svelte";
  import TabBar from "$lib/components/TabBar.svelte";
  import SearchOverlay from "$lib/components/SearchOverlay.svelte";
  import PasteModal from "$lib/components/PasteModal.svelte";
  import OpenDialog from "$lib/components/OpenDialog.svelte";
  import SettingsDialog from "$lib/components/SettingsDialog.svelte";
  import AboutDialog from "$lib/components/AboutDialog.svelte";
  import CustomPromptModal from "$lib/components/CustomPromptModal.svelte";
  import { assembleUrlByIds, consumePendingSelection } from "$lib/stores/aiLookup";
  import FrontmatterBar from "$lib/components/FrontmatterBar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ScrollToTop from "$lib/components/ScrollToTop.svelte";
  import ImageLightbox from "$lib/components/ImageLightbox.svelte";
  import UpdateToast from "$lib/components/UpdateToast.svelte";
  import Editor from "$lib/components/Editor.svelte";
  import { updateScrollPercent } from "$lib/stores/recents";
  import { checkForUpdates, updateAvailable, updateDismissed, checkInFlight } from "$lib/stores/updater";
  import { get } from "svelte/store";
  import { getCurrentSourceLine, scrollToSourceLine, type ViewMode } from "$lib/utils/scroll-sync";
  import { saveProgress, getProgress } from "$lib/stores/readingProgress";

  let rendererReady = $state(false);
  let lastWatchedPath: string | null = null;
  let searchVisible = $state(false);
  let pasteVisible = $state(false);
  let pasteDefaultMode = $state<"paste" | "url">("paste");
  let openVisible = $state(false);
  let settingsVisible = $state(false);
  let aboutVisible = $state(false);
  let customPromptVisible = $state(false);
  let customPromptSelection = $state("");
  let zenMode = $state(false);
  let rawMode = $state(false);

  // Lightbox state
  let lightboxVisible = $state(false);
  let lightboxImages = $state<string[]>([]);
  let lightboxIndex = $state(0);

  // Aggregated flag for any modal/overlay being visible. The close-on-ESC gate
  // and any future "is the user mid-interaction?" check should read this so a
  // new modal can't silently miss the gate by being added to state but not the
  // ESC handler. Each modal's own ESC handler also calls stopPropagation(); the
  // two together cover both focus-inside and focus-outside-modal cases.
  let anyModalVisible = $derived(
    searchVisible || pasteVisible || openVisible || settingsVisible || aboutVisible || customPromptVisible || lightboxVisible
  );

  // Reading progress: debounced scroll save + restore guard
  let isRestoring = false;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  let scrollSaveTimer: ReturnType<typeof setTimeout> | undefined;

  function handleScrollForProgress() {
    if (isRestoring) return;
    const tab = tabStore.getActiveTab();
    if (!tab || tab.isEditing) return;
    if (tab.filePath.startsWith("paste://")) return;

    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      // Tiny-file edge case: skip save if document fits in viewport
      if (document.documentElement.scrollHeight <= window.innerHeight) return;
      const line = getCurrentSourceLine("viewer");
      saveProgress(tab.filePath, line);
    }, 500);
  }

  function saveProgressNow() {
    clearTimeout(scrollSaveTimer);
    const tab = tabStore.getActiveTab();
    if (!tab || tab.isEditing) return;
    if (tab.filePath.startsWith("paste://")) return;
    // Tiny-file edge case: skip save if document fits in viewport
    if (document.documentElement.scrollHeight <= window.innerHeight) return;
    const line = getCurrentSourceLine("viewer");
    saveProgress(tab.filePath, line);
  }

  function handleVisibilityChange() {
    if (document.hidden) saveProgressNow();
  }

  function restoreProgress(filePath: string) {
    const savedLine = getProgress(filePath);
    if (!savedLine || savedLine <= 1) return;

    isRestoring = true;
    clearTimeout(restoreTimer);

    tick().then(() => {
      requestAnimationFrame(() => {
        const article = document.querySelector("article.prose");
        if (!article) { isRestoring = false; return; }

        const elements = Array.from(article.querySelectorAll<HTMLElement>("[data-source-line]"));
        if (elements.length === 0) { isRestoring = false; return; }

        // Find the saved line if it still exists, else fall back to the last
        // element (handles file-shrunk case where saved line no longer exists)
        let target: HTMLElement | null = null;
        for (const el of elements) {
          const elLine = parseInt(el.getAttribute("data-source-line") || "0", 10);
          if (elLine >= savedLine) { target = el; break; }
        }
        if (!target) target = elements[elements.length - 1];

        // Tiny-file edge case: don't restore if document fits in viewport
        const docHeight = document.documentElement.scrollHeight;
        if (docHeight <= window.innerHeight) { isRestoring = false; return; }

        target.scrollIntoView({ behavior: "smooth", block: "start" });

        // Clear isRestoring on scrollend (preferred) with 1s timeout fallback
        // for WebViews that don't support the scrollend event
        const clearRestoring = () => {
          clearTimeout(restoreTimer);
          window.removeEventListener("scrollend", clearRestoring);
          isRestoring = false;
        };
        window.addEventListener("scrollend", clearRestoring, { once: true });
        restoreTimer = setTimeout(clearRestoring, 1000);
      });
    });
  }

  const { tabs, activeTabId } = tabStore;

  let activeTab = $derived<Tab | null>($tabs.find((t) => t.id === $activeTabId) ?? null);
  let canEditActive = $derived(
    !!activeTab?.filePath
    && !activeTab.filePath.startsWith("paste://")
    && !activeTab.filePath.startsWith("url://")
  );
  let currentMode = $derived<ViewMode>(
    activeTab?.isEditing ? "editor" : rawMode ? "raw" : "viewer"
  );

  /**
   * Switch view mode while preserving the source-line position so the user
   * stays anchored at the same place in the document.
   */
  function switchMode(target: ViewMode) {
    if (!activeTab || target === currentMode) return;
    if (target === "editor" && !canEditActive) return;

    const line = getCurrentSourceLine(currentMode);

    // Apply state changes for the target mode
    if (target === "editor") {
      tabStore.setEditing(activeTab.id, true);
    } else {
      // Exiting edit mode: re-render `editContent` (in-memory) so the viewer
      // shows the latest unsaved changes immediately. The dirty indicator
      // continues to mark that the changes aren't on disk yet.
      if (activeTab.isEditing && activeTab.dirty) {
        const baseDir = activeTab.filePath.includes("/")
          ? activeTab.filePath.substring(0, activeTab.filePath.lastIndexOf("/"))
          : undefined;
        const result = renderFull(activeTab.editContent, baseDir);
        // Update the rendered HTML in the docStore so the viewer reflects
        // the unsaved edits. We do NOT call tabStore.updateTabContent or
        // markSaved — the source on disk is unchanged, dirty stays true.
        docStore.set({
          filePath: activeTab.filePath,
          fileName: activeTab.fileName,
          content: activeTab.content,             // disk content (unchanged)
          renderedHtml: result.html,              // preview of unsaved edits
          frontmatter: result.frontmatter,
          wordCount: result.wordCount,
          loading: false,
          error: null,
        });
      }
      if (activeTab.isEditing) tabStore.setEditing(activeTab.id, false);
      rawMode = target === "raw";
    }

    // Scroll the destination after it renders. Two rAFs are needed for the
    // editor — the first lets Svelte mount the textarea, the second lets the
    // browser compute its scrollHeight before we set scrollTop.
    tick().then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSourceLine(target, line));
      });
    });
  }

  async function handleSave(tab: Tab) {
    if (!tab.dirty) return;
    try {
      await saveFile(tab.filePath, tab.editContent);
      const baseDir = tab.filePath.includes("/")
        ? tab.filePath.substring(0, tab.filePath.lastIndexOf("/"))
        : undefined;
      const result = renderFull(tab.editContent, baseDir);
      tabStore.markSaved(tab.id);
      tabStore.updateTabContent(
        tab.filePath,
        tab.editContent,
        result.html,
        result.frontmatter,
        result.wordCount
      );
      // Sync docStore so the rendered view reflects the saved content immediately
      // when the user toggles out of edit mode (the tab-sync $effect only fires on
      // active-tab change, not on content updates of the same tab).
      docStore.set({
        filePath: tab.filePath,
        fileName: tab.fileName,
        content: tab.editContent,
        renderedHtml: result.html,
        frontmatter: result.frontmatter,
        wordCount: result.wordCount,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Save failed:", err);
      alert(`Save failed: ${err}`);
    }
  }

  function handleEditToggle() {
    if (!canEditActive || !activeTab) return;
    if (activeTab.isEditing) {
      // Exiting edit — go back to whichever non-edit mode was active before
      switchMode(rawMode ? "raw" : "viewer");
    } else {
      switchMode("editor");
    }
  }

  function handleRawToggle() {
    if (activeTab?.isEditing) return;
    switchMode(rawMode ? "viewer" : "raw");
  }

  function handleCloseTab(id: string): boolean {
    const t = $tabs.find((x) => x.id === id);
    if (!t) return false;
    if (t.dirty && !confirm(`Discard unsaved changes to ${t.fileName}?`)) return false;
    // Flush reading progress before closing — catches the case where user
    // scrolls and closes within the 500ms debounce window
    if (t.id === $activeTabId) {
      saveProgressNow();
    }
    tabStore.closeTab(id);
    return true;
  }

  onMount(async () => {
    initRenderer();
    rendererReady = true;

    // Expose functions for native menu and OS file-open handlers
    (window as any).__mdhero_open_file = () => { openVisible = true; };
    (window as any).__mdhero_open_path = (path: string) => {
      if (path && rendererReady) {
        openFile(path);
      }
    };
    (window as any).__mdhero_paste = () => {
      pasteDefaultMode = "paste";
      pasteVisible = true;
    };
    (window as any).__mdhero_toggle_theme = () => {
      themeMode.update((m) => cycleTheme(m));
    };
    (window as any).__mdhero_find = () => {
      searchVisible = !searchVisible;
    };
    (window as any).__mdhero_zen = () => {
      zenMode = !zenMode;
    };
    (window as any).__mdhero_about = () => {
      aboutVisible = true;
    };
    (window as any).__mdhero_check_updates = async () => {
      if (get(checkInFlight)) return;
      // Reset dismissal so a manual check always re-surfaces an available update.
      updateDismissed.set(false);
      await checkForUpdates(true);
      // If still nothing, give the user explicit feedback — silence is confusing
      // when a menu item is the trigger.
      if (!get(updateAvailable)) {
        alert("MDHero is up to date.");
      }
    };
    // Router for AI Lookup right-click menu items. lib.rs::setup forwards any
    // menu event ID starting with "aimenu:" through this hook. The current
    // selection was stashed in the aiLookup runtime helper at contextmenu
    // capture time — we consume it here so a stale selection can't leak into
    // a future menu open.
    (window as any).__mdhero_ai_lookup = async (menuId: string) => {
      const selection = consumePendingSelection();
      if (menuId === "aimenu:google") {
        if (!selection.trim()) return;
        const url = `https://www.google.com/search?q=${encodeURIComponent(selection)}`;
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
      }
      if (menuId === "aimenu:custom") {
        customPromptSelection = selection;
        customPromptVisible = true;
        return;
      }
      if (menuId.startsWith("aimenu:template:")) {
        // aimenu:template:{providerId}:{promptId}
        const rest = menuId.slice("aimenu:template:".length);
        const colon = rest.indexOf(":");
        if (colon < 0) return;
        const providerId = rest.slice(0, colon);
        const promptId = rest.slice(colon + 1);
        const url = assembleUrlByIds(providerId, promptId, selection);
        if (!url) return;
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
      }
      // aimenu:noop:* fires only from disabled items in theory — defensive ignore.
    };

    // Listen for keyboard shortcuts and scroll for reading progress
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", handleScrollForProgress, { passive: true });
    window.addEventListener("beforeunload", saveProgressNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check for files opened via "Open With" / double-click (buffered in Rust state)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const openedFiles = await invoke<string[]>("get_opened_files");
      if (openedFiles.length > 0) {
        await openFile(openedFiles[0]);
      }
    } catch {}

    // Check for updates (non-blocking, skips in dev)
    checkForUpdates();

    // Check for CLI file argument
    try {
      const { getMatches } = await import("@tauri-apps/plugin-cli");
      const matches = await getMatches();
      if (matches.args?.file?.value) {
        await openFile(matches.args.file.value as string);
      }
    } catch {
      // CLI plugin may not be available in dev
    }

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("scroll", handleScrollForProgress);
      window.removeEventListener("beforeunload", saveProgressNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });

  let lastKey = "";
  let lastKeyTime = 0;

  function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
  }

  function jumpToHeading(direction: "prev" | "next") {
    const headings = document.querySelectorAll("article h1[id], article h2[id], article h3[id], article h4[id], article h5[id], article h6[id]");
    if (headings.length === 0) return;
    const offset = 80;
    const scrollY = window.scrollY + offset;

    if (direction === "next") {
      for (const h of headings) {
        const top = (h as HTMLElement).offsetTop;
        if (top > scrollY + 5) {
          window.scrollTo({ top: top - offset, behavior: "smooth" });
          return;
        }
      }
    } else {
      const arr = Array.from(headings).reverse();
      for (const h of arr) {
        const top = (h as HTMLElement).offsetTop;
        if (top < scrollY - 5) {
          window.scrollTo({ top: top - offset, behavior: "smooth" });
          return;
        }
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Cmd+1-9 tab switching
    if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if ($tabs[idx]) {
        tabStore.switchTab($tabs[idx].id);
      }
      return;
    }

    // Cmd+Plus / Cmd+= zoom in (works on both macOS and Windows)
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.min(s.fontSize + 1, 32) }));
      return;
    }

    // Cmd+Minus zoom out
    if ((e.metaKey || e.ctrlKey) && e.key === "-") {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: Math.max(s.fontSize - 1, 10) }));
      return;
    }

    // Cmd+0 reset zoom
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault();
      settings.update((s) => ({ ...s, fontSize: 17 }));
      return;
    }

    // Cmd+E toggle edit mode
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "e") {
      e.preventDefault();
      handleEditToggle();
      return;
    }

    // Cmd+S save (works whenever the active tab has unsaved changes,
    // even from reader mode after toggling out of edit)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "s") {
      e.preventDefault();
      if (activeTab?.dirty) {
        handleSave(activeTab);
      }
      return;
    }

    // Cmd+U raw toggle (disabled in edit mode)
    if ((e.metaKey || e.ctrlKey) && e.key === "u") {
      e.preventDefault();
      handleRawToggle();
      return;
    }

    // Cmd+T new tab (go home)
    if ((e.metaKey || e.ctrlKey) && e.key === "t") {
      e.preventDefault();
      tabStore.goHome();
      return;
    }

    // Cmd+, open settings (macOS Preferences convention)
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      settingsVisible = !settingsVisible;
      return;
    }

    // Cmd+W close tab (with dirty confirm)
    if ((e.metaKey || e.ctrlKey) && e.key === "w") {
      e.preventDefault();
      const t = tabStore.getActiveTab();
      if (!t) return;
      handleCloseTab(t.id);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
      e.preventDefault();
      zenMode = !zenMode;
      return;
    }

    // Escape — close panels, then optionally close-tab-on-ESC
    if (e.key === "Escape") {
      if (zenMode) { zenMode = false; return; }

      // Modals/overlays consume ESC first. Inner handlers stopPropagation when focus
      // is inside them; this guard covers the focus-outside case (modal visible but
      // user clicked elsewhere) so we don't nuke the tab while a modal is still up.
      // Add new modals to `anyModalVisible` (see top of script) to keep this safe.
      if (anyModalVisible) return;

      // Close-on-ESC: opt-in setting. Ignore in edit mode and when an input is focused
      // (so users typing in search/paste/etc. don't accidentally trigger it).
      if ($settings.closeOnEscape && !activeTab?.isEditing && !isInputFocused()) {
        const tabsBeforeClose = $tabs.length;

        if (activeTab && activeTab.id !== HOME_TAB_ID) {
          // Close the current file tab (handleCloseTab manages the dirty prompt)
          const closed = handleCloseTab(activeTab.id);
          // If that was the last file tab, quit the app entirely.
          // On macOS this is required — closing the window leaves the app in the dock.
          if (closed && tabsBeforeClose === 1) {
            invoke("quit_app").catch(() => {});
          }
        } else if (tabsBeforeClose === 0) {
          // Active is home tab and no file tabs are open → quit
          invoke("quit_app").catch(() => {});
        }
        // Else: home tab is active with file tabs in background — do nothing
        // (don't nuke the user's session just because they happened to be on home)
      }
      return;
    }

    // Vim-style keys — only when no input is focused and not in edit mode
    if (isInputFocused() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (activeTab?.isEditing) return;
    if (!$docStore.renderedHtml) return;

    const now = Date.now();

    switch (e.key) {
      case "j":
        e.preventDefault();
        window.scrollBy({ top: 100, behavior: "smooth" });
        break;
      case "k":
        e.preventDefault();
        window.scrollBy({ top: -100, behavior: "smooth" });
        break;
      case "d":
        // half page down
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight / 2, behavior: "smooth" });
        break;
      case "u":
        // half page up
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight / 2, behavior: "smooth" });
        break;
      case "G":
        // Shift+G — go to bottom
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        break;
      case "g":
        // gg — go to top (double tap g within 500ms)
        if (lastKey === "g" && now - lastKeyTime < 500) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          lastKey = "";
          return;
        }
        break;
      case "/":
        e.preventDefault();
        searchVisible = true;
        break;
      case "n":
        // next search match (handled by SearchOverlay if visible)
        break;
      case "]":
        e.preventDefault();
        jumpToHeading("next");
        break;
      case "[":
        e.preventDefault();
        jumpToHeading("prev");
        break;
    }

    lastKey = e.key;
    lastKeyTime = now;
  }

  // Sync tab switching with document store — only reads $activeTabId and $tabs
  let prevTabId: string | null = null;

  $effect(() => {
    const id = $activeTabId;
    const allTabs = $tabs;

    // Skip if same tab
    if (id === prevTabId) return;

    // Save reading progress for the tab we're leaving.
    // At this point in the $effect, $activeTabId has changed but the DOM still
    // shows the previous tab's content (docStore.set happens below), so
    // getCurrentSourceLine reads the correct article elements. We flush the
    // debounce to ensure nothing is lost on rapid tab switches.
    if (prevTabId && prevTabId !== HOME_TAB_ID) {
      const prevTab = allTabs.find((t) => t.id === prevTabId);
      if (prevTab && !prevTab.isEditing && !prevTab.filePath.startsWith("paste://")) {
        clearTimeout(scrollSaveTimer);
        if (document.documentElement.scrollHeight > window.innerHeight) {
          const line = getCurrentSourceLine("viewer");
          saveProgress(prevTab.filePath, line);
        }
      }
    }

    prevTabId = id;

    if (!id || id === HOME_TAB_ID) {
      rawMode = false;
      docStore.set({
        filePath: null,
        fileName: null,
        content: "",
        renderedHtml: "",
        frontmatter: null,
        wordCount: 0,
        loading: false,
        error: null,
      });
      tocVisible.set(false);
      tocEntries.set([]);
      getCurrentWindow().setTitle("MDHero").catch(() => {});
      return;
    }

    const tab = allTabs.find((t) => t.id === id);
    if (!tab) return;

    docStore.set({
      filePath: tab.filePath,
      fileName: tab.fileName,
      content: tab.content,
      renderedHtml: tab.renderedHtml,
      frontmatter: tab.frontmatter,
      wordCount: tab.wordCount,
      loading: false,
      error: null,
    });

    getCurrentWindow().setTitle(`${tab.fileName} — MDHero`).catch(() => {});

    const savedScroll = tab.scrollTop;
    tick().then(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScroll);
        // Restore reading progress (smooth-scroll to saved source line)
        // Only if the tab is at scroll 0 (freshly opened or re-opened)
        if (savedScroll === 0) {
          restoreProgress(tab.filePath);
        }
      });
    });
  });

  // Watch for file path changes to set up watcher (only when path actually changes)
  $effect(() => {
    const path = $docStore.filePath;
    if (path && !path.startsWith("paste://") && path !== lastWatchedPath) {
      lastWatchedPath = path;
      startFileWatcher(path);
    }
  });
</script>

<div class="min-h-screen transition-colors page-root">
  {#if !zenMode}
    <ProgressBar />
    <Toolbar
      onOpen={() => (openVisible = true)}
      onPaste={() => { pasteDefaultMode = "paste"; pasteVisible = true; }}
      onUrl={() => { pasteDefaultMode = "url"; pasteVisible = true; }}
      {rawMode}
      onRawToggle={handleRawToggle}
      isEditing={activeTab?.isEditing ?? false}
      dirty={activeTab?.dirty ?? false}
      canEdit={canEditActive}
      onEditToggle={handleEditToggle}
      onSave={() => activeTab && handleSave(activeTab)}
      onOpenSettings={() => (settingsVisible = true)}
    />
    <TabBar onCloseTab={handleCloseTab} />
  {/if}
  <DropZone />
  {#if !zenMode && !activeTab?.isEditing}
    <TableOfContents />
  {/if}
  <SearchOverlay bind:visible={searchVisible} />
  <PasteModal bind:visible={pasteVisible} defaultMode={pasteDefaultMode} />
  <OpenDialog bind:visible={openVisible} />
  <SettingsDialog bind:visible={settingsVisible} />
  <AboutDialog bind:visible={aboutVisible} />
  <CustomPromptModal bind:visible={customPromptVisible} selection={customPromptSelection} />

  {#if !rendererReady}
    <div class="state-center">
      <p class="state-text pulse">Loading renderer...</p>
    </div>
  {:else if $docStore.loading}
    <div class="state-center">
      <p class="state-text pulse">Opening file...</p>
    </div>
  {:else if $docStore.error}
    <div class="state-center">
      <div class="error-box">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p class="error-msg">{$docStore.error}</p>
      </div>
    </div>
  {:else if $docStore.renderedHtml}
    {#if activeTab?.isEditing}
      <Editor
        value={activeTab.editContent}
        onChange={(v) => tabStore.updateEditContent(activeTab!.id, v)}
        fontSize={$settings.fontSize}
        lineHeight={$settings.lineHeight}
        maxWidth={$settings.maxWidth}
      />
    {:else if rawMode}
      <main class="content-main">
        <pre
          class="raw-source"
          style="font-size: {$settings.fontSize}px; line-height: {$settings.lineHeight}; max-width: {$settings.maxWidth}px;"
        ><code>{$docStore.content}</code></pre>
      </main>
    {:else}
      <FrontmatterBar />
      <main class="content-main">
        <MarkdownRenderer
          html={$docStore.renderedHtml}
          onImageClick={(src, all, idx) => { lightboxImages = all; lightboxIndex = idx; lightboxVisible = true; }}
        />
      </main>
    {/if}
    {#if !zenMode && !activeTab?.isEditing}
      <StatusBar />
      <ScrollToTop />
    {/if}
    <ImageLightbox bind:visible={lightboxVisible} src="" images={lightboxImages} bind:index={lightboxIndex} />
  {:else}
    <EmptyState onOpenUrl={() => { pasteDefaultMode = "url"; pasteVisible = true; }} />
  {/if}
  <UpdateToast />
</div>

<style>
  .page-root {
    background: #fafafa;
    color: #1c1c1e;
  }

  :global(html.dark) .page-root {
    background: #161618;
    color: #e5e5e7;
  }

  .state-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 75vh;
  }

  .state-text {
    font-size: 14px;
    color: #aeaeb2;
  }

  .pulse {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    max-width: 400px;
  }

  .error-msg {
    font-size: 13px;
    color: #8e8e93;
    line-height: 1.5;
  }

  .content-main {
    padding-bottom: 4rem;
  }

  .raw-source {
    margin: 0 auto;
    padding: 24px 32px;
    font-family: "SF Mono", "JetBrains Mono", Menlo, monospace;
    color: #1c1c1e;
    white-space: pre-wrap;
    word-break: break-word;
    background: transparent;
    border: none;
  }

  :global(html.dark) .raw-source {
    color: #d1d1d6;
  }
</style>
