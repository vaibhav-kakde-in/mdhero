/**
 * English messages — the baseline dictionary. Every UI string lives here.
 *
 * Keys follow `namespace.element` in camelCase; `{placeholders}` are filled in
 * by `translate()`. `zh.ts` mirrors these keys as `Record<MessageKey, string>`,
 * so a missing translation fails `pnpm check`.
 */
export const en = {
  // Shared across components
  "common.add": "Add",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.copied": "Copied!",
  "common.failed": "Failed",
  "common.save": "Save",
  "common.unsavedChanges": "Unsaved changes",

  // Settings dialog
  "settings.title": "Settings",
  "settings.general": "General",
  "settings.language": "Language",
  "settings.languageHint": "Interface language. Follow system matches your operating system.",
  "settings.languageSystem": "Follow system",
  "settings.languageZh": "简体中文",
  "settings.languageEn": "English",
  "settings.behavior": "Behavior",
  "settings.closeOnEscape": "Close on Escape",
  "settings.closeOnEscapeHint": "Press ESC to close the current tab. App quits after the last tab.",
  "settings.restoreTabs": "Restore tabs on launch",
  "settings.restoreTabsHint": "Reopen the files that were open last time, in the same order.",
  "settings.autoPresentMarp": "Auto-present Marp decks",
  "settings.autoPresentMarpHint": "Open documents with <code>marp: true</code> frontmatter as a slideshow.",
  "settings.editor": "Editor",
  "settings.lineNumbers": "Line numbers",
  "settings.lineNumbersHint": "Show a line-number gutter in the editor.",
  "settings.aiSection": "AI Lookup",
  "settings.aiSectionHint": "Right-click selected text in the viewer to send it to an AI tool. Manage providers and saved prompts below.",

  // Toolbar
  "toolbar.open": "Open",
  "toolbar.openTitle": "Open file ({mod}+O)",
  "toolbar.paste": "Paste",
  "toolbar.pasteTitle": "Paste markdown ({mod}+Shift+V)",
  "toolbar.openUrlTitle": "Open URL",
  "toolbar.viewModeAria": "View mode",
  "toolbar.modeTitleOpenFirst": "View · Split · Edit (open a file first)",
  "toolbar.modeTitleLocalOnly": "Split and Edit are only available for local files",
  "toolbar.modeTitle": "View · Split · Edit",
  "toolbar.view": "View",
  "toolbar.split": "Split",
  "toolbar.edit": "Edit",
  "toolbar.tocTitleOpenFirst": "Table of Contents (open a file first)",
  "toolbar.tocTitleExitEdit": "Table of Contents (exit edit mode to use)",
  "toolbar.tocTitleEmpty": "Table of Contents (no headings in this document)",
  "toolbar.tocTitle": "Table of Contents",
  "toolbar.readingPrefsTitleOpenFirst": "Reading preferences (open a file first)",
  "toolbar.readingPrefsTitle": "Reading preferences (Aa)",
  "toolbar.wideTitleOpenFirst": "Toggle wide view (open a file first)",
  "toolbar.wideTitleComfortable": "Use comfortable width",
  "toolbar.wideTitleWide": "Use wide viewport",
  "toolbar.rawTitleOpenFirst": "View raw markdown (open a file first)",
  "toolbar.rawTitleExitEdit": "View raw markdown (exit edit mode to use)",
  "toolbar.rawTitle": "View raw markdown ({mod}+U)",
  "toolbar.presentStart": "Present slideshow",
  "toolbar.presentExit": "Exit presentation",
  "toolbar.presentExitWithEsc": "Exit presentation (Esc)",
  "toolbar.saveTitleDirty": "Save unsaved changes ({mod}+S)",
  "toolbar.saveTitleClean": "Save (no changes to save)",
  "toolbar.copyTitleOpenFirst": "Copy content (open a file first)",
  "toolbar.copyTitleExitEdit": "Copy content (exit edit mode to use)",
  "toolbar.copyTitle": "Copy content",
  "toolbar.copyRichText": "Rich Text",
  "toolbar.copyRichTextHint": "for Docs / Notion",
  "toolbar.copyMarkdown": "Markdown",
  "toolbar.copyMarkdownHint": "raw source",
  "toolbar.pdfTitleOpenFirst": "Export PDF (open a file first)",
  "toolbar.pdfTitleExitEdit": "Export PDF (exit edit mode to use)",
  "toolbar.pdfTitle": "Export PDF",
  "toolbar.settingsTitle": "Settings ({mod}+,)",
  "toolbar.settingsAria": "Settings",
  "toolbar.themeToggle": "Toggle theme",

  // Home / empty state
  "empty.tagline": "A native Markdown reader and editor.",
  "empty.newDocument": "New Document",
  "empty.browseFiles": "Browse Files",
  "empty.openUrl": "Open URL",
  "empty.pinFolder": "Pin Folder",
  "empty.recentFiles": "Recent Files",
  "empty.clear": "Clear",
  "empty.claudePlans": "Claude Plans",
  "empty.hidePlans": "Hide Claude Plans",
  "empty.showPlans": "Show Claude Plans",
  "empty.unpin": "Unpin",
  "empty.loading": "Loading...",
  "empty.noMarkdownFiles": "No markdown files",
  "empty.footerBrowse": "browse",
  "empty.footerPaste": "paste",
  "empty.footerNewTab": "new tab",
  "empty.zoomOut": "Zoom out",
  "empty.zoomIn": "Zoom in",

  // Custom prompt modal
  "customPrompt.title": "Custom AI Prompt",
  "customPrompt.selectedText": "Selected text",
  "customPrompt.noSelection": "No selection — your prompt will be sent as-is.",
  "customPrompt.yourPrompt": "Your prompt",
  "customPrompt.appendHint": "(the selection above will be appended)",
  "customPrompt.placeholderWithSelection": "Give me a concise background on this company:",
  "customPrompt.placeholder": "Type your prompt…",
  "customPrompt.provider": "Provider",
  "customPrompt.noProviders": "No providers configured — add one in Settings.",
  "customPrompt.opening": "Opening…",
  "customPrompt.send": "Send →",
  "customPrompt.openUrlFailed": "Failed to open URL",

  // Relative timestamps (recents, pinned folders)
  "time.justNow": "Just now",
  "time.minutesAgo": "{mins}m ago",
  "time.hoursAgo": "{hours}h ago",
  "time.daysAgo": "{days}d ago",

  // URL loading (shared by the Open dialog and the Paste modal)
  "url.invalid": "Please enter a valid URL",
  "url.networkError": "Network error: {msg}",
  "url.unreachable": "Could not reach URL",

  // Open dialog
  "openDialog.title": "Open",
  "openDialog.browseFiles": "Browse Files...",
  "openDialog.urlPlaceholder": "Paste a URL to open...",
  "openDialog.fetch": "Fetch",
  "openDialog.tabRecent": "Recent",
  "openDialog.tabFolders": "Folders",
  "openDialog.tabPlans": "Plans",
  "openDialog.noRecent": "No recent files",
  "openDialog.noPinned": "No pinned folders",
  "openDialog.pinFolder": "Pin a folder",
  "openDialog.folderLoading": "Loading...",
  "openDialog.addFolder": "Add folder",
  "openDialog.loadingPlans": "Loading plans...",
  "openDialog.noPlans": "No Claude Code plans found",
  "openDialog.plansPathHint": "Plans are stored in ~/.claude/plans/",
  "openDialog.notFound": "File not found.",
  "openDialog.forbidden": "Access denied.",
  "openDialog.httpFailed": "Failed ({status})",
  "openDialog.htmlNotMarkdown": "URL returned HTML, not markdown.",

  // Paste modal
  "paste.tabPaste": "Paste",
  "paste.tabUrl": "Open URL",
  "paste.llmDetected": "LLM detected",
  "paste.llmMode": "LLM Mode",
  "paste.placeholder": "Paste markdown here...\n\nSupports raw markdown and LLM API responses with escaped \\n characters.",
  "paste.hintRender": "{mod}+Enter to render",
  "paste.render": "Render",
  "paste.fetching": "Fetching...",
  "paste.fetch": "Fetch",
  "paste.supportedUrls": "Supported URLs:",
  "paste.github": "GitHub",
  "paste.gist": "Gist",
  "paste.gitlab": "GitLab",
  "paste.bitbucket": "Bitbucket",
  "paste.anyRawUrl": "Any raw URL",
  "paste.hintFetch": "{mod}+Enter to fetch",
  "paste.urlNotFound": "File not found. Check the URL or ensure the repo is public.",
  "paste.urlForbidden": "Access denied. This may be a private repository.",
  "paste.urlFetchFailed": "Failed to fetch ({status})",
  "paste.urlHtml": "URL returned HTML, not markdown. Try a raw/direct link.",
  "paste.tabName": "Pasted — {time}",

  // Reader controls
  "reader.title": "Reading Preferences",
  "reader.font": "Font",
  "reader.fontSans": "Sans",
  "reader.fontSerif": "Serif",
  "reader.fontMono": "Mono",
  "reader.textSize": "Text size",
  "reader.lineSpacing": "Line spacing",
  "reader.widthMode": "Width mode",
  "reader.comfortable": "Comfortable",
  "reader.wide": "Wide",
  "reader.contentWidth": "Content width",

  // Status bar
  "status.words": "{count} words",
  "status.readingTime": "{mins} min read",
  "status.tokens": "~{tokens} tokens",
  "status.tokensK": "~{tokens}k tokens",

  // Tabs
  "tabBar.changedOnDisk": "Changed on disk while you were editing",
  "tabBar.newTab": "New tab",
  "tabBar.copyPath": "Copy Path",

  // Search overlay
  "search.placeholder": "Find in document...",
  "search.prev": "Previous (Shift+Enter)",
  "search.next": "Next (Enter)",
  "search.closeHint": "Close (Esc)",

  // Table of contents
  "toc.onThisPage": "On this page",
  "toc.resizeAria": "Resize table of contents",
  "toc.resizeHint": "Drag to resize — double-click to reset",

  // Presentation
  "present.exitWithEsc": "Exit presentation (Esc)",
  "present.exit": "Exit presentation",
  "present.prev": "Previous slide",
  "present.next": "Next slide",

  // Drop zone / scroll-to-top
  "dropZone.label": "Drop to open",
  "scrollTop.title": "Scroll to top (gg)",

  // Updates
  "update.downloading": "Downloading… {progress}%",
  "update.installing": "Installing…",
  "update.downloadingUpdate": "Downloading update… {progress}%",
  "update.installingUpdate": "Installing update…",
  "update.failed": "Update failed",
  "update.isAvailable": "is available",
  "update.availablePrefix": "Update available —",
  "update.downloadManually": "Download manually",
  "update.updateNow": "Update now",
  "update.later": "Later",
  "update.releaseNotes": "Release notes",
  "update.dismissHint": "Dismiss until next release",
  "update.errorDevBuild": "In-app updates are only available in installed builds, not dev.",
  "update.errorNoUpdate": "No update available.",

  // About dialog
  "about.title": "About MDHero",
  "about.version": "Version {version}",
  "about.versionUnknown": "Version unknown",
  "about.description": "A beautiful, fast Markdown viewer for your desktop.",

  // File operations (frontend-side messages)
  "files.untitled": "Untitled",
  "files.openFailed": "Failed to open file: {error}",

  // Markdown renderer (injected code-block buttons)
  "markdown.copy": "Copy",
  "markdown.copied": "Copied!",

  // Main page states
  "page.loadingRenderer": "Loading renderer...",
  "page.openingFile": "Opening file...",

  // Native confirm prompts / alerts
  "dialog.unsavedOne": "You have unsaved changes to {name}.",
  "dialog.unsavedMany": "You have unsaved changes in {count} tabs.",
  "dialog.keepEditing": "Keep Editing",
  "dialog.discard": "Discard",
  "dialog.fileChangedOnDisk": "File changed on disk",
  "dialog.fileChangedOnDiskBody": "{name} changed on disk while you were editing. Saving will overwrite that version.",
  "dialog.overwrite": "Overwrite",
  "dialog.saveFailed": "Save failed: {error}",
  "dialog.upToDate": "MDHero is up to date.",

  // Toasts
  "toast.fileNotFound": "Can't find “{name}”",
  "toast.executableRefused": "Won't open executable file “{name}”. Open it from your file manager if you trust it.",
  "toast.openFailed": "Couldn't open “{name}”",

  // AI lookup validation
  "ai.error.nameRequired": "Name is required",
  "ai.error.templateRequired": "Template is required",
  "ai.error.urlRequired": "URL is required",
  "ai.error.urlTokenMissing": "URL must contain {prompt} where the query goes",
  "ai.error.urlTokenMultiple": "URL must contain {prompt} only once",
  "ai.error.urlInvalid": "URL is not valid",

  // AI lookup settings UI
  "ai.editProvider": "Edit provider",
  "ai.deleteProvider": "Delete provider",
  "ai.editPrompt": "Edit prompt",
  "ai.deletePrompt": "Delete prompt",
  "ai.providerNamePlaceholder": "Provider name",
  "ai.promptNamePlaceholder": "Prompt name",
  "ai.templatePlaceholder": "Template — use {selection} where the text goes",
  "ai.addProvider": "+ Add provider",
  "ai.addPrompt": "+ Add prompt",
  "ai.defaultForCustomPrompt": "Default for Custom prompt",
  "ai.resetTitle": "Reset to defaults",
  "ai.resetAria": "Reset all providers and prompts to defaults",
  "ai.confirm.deleteProvider": "Delete \"{name}\"?",
  "ai.confirm.deleteProviderPrompts.one": "Delete \"{name}\" and its 1 prompt?",
  "ai.confirm.deleteProviderPrompts.other": "Delete \"{name}\" and its {count} prompts?",
  "ai.confirm.deletePrompt": "Delete prompt \"{name}\"?",
  "ai.confirm.reset": "Reset all providers and prompts to defaults? Your customizations will be lost.",
} as const;

export type MessageKey = keyof typeof en;