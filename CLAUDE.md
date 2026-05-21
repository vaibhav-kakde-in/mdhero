# CLAUDE.md

## Commands

```bash
pnpm tauri dev          # Run dev server with hot-reload (frontend + Rust)
pnpm tauri build        # Production build (outputs DMG/MSI)
pnpm build              # Build frontend only (SvelteKit static)
pnpm check              # TypeScript type checking
cargo build --manifest-path src-tauri/Cargo.toml  # Build Rust backend only
```

Port 1420 is used for dev. Kill stale processes with `lsof -ti:1420 | xargs kill -9` before relaunching.

## What This Is

A lightweight, native desktop Markdown viewer & editor (~8MB binary) built with Tauri v2 + SvelteKit. Opens `.md` files and renders them beautifully with syntax highlighting, math, and diagrams. Includes a toggleable in-app editor (`Cmd+E` to enter, `Cmd+S` to save), an LLM paste-to-render mode for AI-generated markdown, and an Open URL fetcher. A "Close on Escape" setting (on by default, toggleable in Settings) makes it usable as a file-manager viewer (right-click → Open With → MDHero → ESC). Targets macOS (Apple Silicon) and Windows. Open source (MIT).

**Multi-repo:** the desktop app source is in this repo (`mdhero`). The marketing/landing site is in a sibling repo `mdhero-site` (Astro on Vercel) and also hosts the `/api/version` update endpoint that the app queries.

## Architecture

Single-window app. Rust backend handles file I/O, write-back, and watching; SvelteKit frontend handles rendering, editing, and UI.

**Rendering pipeline** (`src/lib/renderer/pipeline.ts`): markdown-it parses markdown → highlight.js highlights code (25+ languages, synchronous, no WASM) → markdown-it-texmath renders KaTeX math → DOMPurify sanitizes HTML → Svelte renders via `{@html}`. Mermaid diagrams are post-processed after DOM update in `MarkdownRenderer.svelte`. A custom markdown-it core rule stamps `data-source-line="N"` on top-level block tokens — used for cross-mode scroll sync.

**File watching** (`src-tauri/src/watcher.rs`): Watches the parent directory (not the file directly) using the `notify` crate with 500ms debounce. This survives atomic saves (delete + rename) that editors like VS Code and vim use. Emits `file-changed` Tauri event filtered by target filename. The frontend watcher (`src/lib/tauri/watcher.ts`) suppresses reloads within 1.5s of an own-write (after `Cmd+S` from the in-app editor) by checking `tab.lastSavedAt`.

**Tab + edit state** (`src/lib/stores/tabs.ts`): Each tab carries `content` (on-disk), `editContent` (in-progress), `dirty`, `isEditing`, and `lastSavedAt`. The `Tab.isEditing` field is per-tab so users can edit one file while reading another. Switching tabs preserves edit state. External file changes (after the suppression window) update `content` only and recompute `dirty` — never clobber `editContent` while editing.

**Scroll sync** (`src/lib/utils/scroll-sync.ts`): Toggling between viewer/raw/editor preserves the source-line position. Viewer reads the topmost visible block's `data-source-line`. Raw and editor estimate the line via `scrollTop / lineHeight`. The destination scrolls to put the same source line at the top. Mode toggles route through `switchMode(target)` in `+page.svelte`.

**State management**: Svelte stores in `src/lib/stores/`. `tabs.ts` (multi-tab + edit state), `document.ts` (active document), `theme.ts` (light/dark/system, class-based), `settings.ts` (font/line/width/family/`closeOnEscape`, persisted to localStorage), `pinned.ts` (pinned folders), `recents.ts` (recent files), `toc.ts` (TOC entries + active heading), `updater.ts` (24h-throttled update check against `mdhero.app/api/version` with GitHub fallback, per-version dismissal).

**Tauri bridge** (`src/lib/tauri/`): `files.ts` wraps IPC commands and coordinates opening/reloading/saving. `watcher.ts` listens for `file-changed` events with own-save suppression.

**Update checker** (`src/lib/stores/updater.ts`): App checks `https://mdhero.app/api/version` once per 24h (with GitHub Releases API as fallback) and surfaces an `UpdateBanner` on the home tab or `UpdateToast` on document tabs. The 24h throttle is enforced via `lastUpdateCheck` in localStorage. Per-version dismissals (`dismissedFor:0.2.x`) ensure "Later" hides only that specific version — the next release re-surfaces. The "Check for Updates…" menu item bypasses the throttle. Skipped in dev builds (`import.meta.env.DEV`) unless explicitly forced. The endpoint also increments aggregate DAU counters in Upstash (no device IDs, no IPs in storage — only OS family and source version).

**Close-on-Escape** (default on, toggle in Settings → Behavior): when `settings.closeOnEscape` is true, ESC in viewer mode closes the current tab; if it was the last file tab, the app fully quits via the Rust `quit_app` command (`AppHandle::exit(0)`). Required on macOS because closing the last window normally leaves the app in the dock. ESC is gated by `!isEditing && !isInputFocused()` AND every open modal flag (search/paste/open/settings/lightbox). Modal precedence is enforced both ways: each modal's ESC handler `stopPropagation()`s, AND the window-level gate short-circuits while any of those flags are true — without both, ESC outside a focused modal would close the tab while the modal stayed visible.

## Key Files

### Frontend
- `src/lib/renderer/pipeline.ts` — Core rendering: markdown-it + highlight.js + KaTeX + DOMPurify + source-line stamps
- `src/lib/components/MarkdownRenderer.svelte` — Renders HTML, handles Mermaid post-processing, TOC extraction via IntersectionObserver
- `src/lib/components/Editor.svelte` — In-app editor (textarea, fixed positioning, monospace, Tab inserts spaces)
- `src/lib/components/PasteModal.svelte` — Paste-to-render + Open URL modal
- `src/lib/components/SearchOverlay.svelte` — Cmd+F search with mark.js highlighting
- `src/lib/components/TabBar.svelte` — Tabs with home tab, drag reorder, dirty `•` indicator
- `src/lib/components/Toolbar.svelte` — All toolbar buttons; everything stays visible and disables (with tooltip) when not applicable
- `src/lib/components/EmptyState.svelte` — Home tab UI: pinned folders, recent files, plans
- `src/lib/components/OpenDialog.svelte` — Cmd+O dialog: browse, recent, plans, pinned folders, URL
- `src/lib/components/ReaderControls.svelte` — Reading Preferences popover ("Aa" toolbar button): font, size, line height, content width
- `src/lib/components/SettingsDialog.svelte` — Settings dialog (gear toolbar button, `Cmd+,`): Behavior section with "Close on Escape" toggle. Sectioned layout designed to take more sections as the app grows.
- `src/lib/components/UpdateBanner.svelte` — Inline update banner shown on home tab
- `src/lib/components/UpdateToast.svelte` — Floating update toast shown on document tabs
- `src/lib/utils/scroll-sync.ts` — Cross-mode scroll anchoring on source line
- `src/lib/utils/llm.ts` — LLM output detection and unescaping (`\n`, `\"`, JSON strings)
- `src/lib/utils/url.ts` — URL → raw URL conversion (GitHub blob, gist, GitLab, Bitbucket)
- `src/lib/utils/clipboard.ts` — Copy as rich text (HTML) or raw markdown
- `src/lib/tauri/files.ts` — File open, save, reload (dialog, drag-drop, CLI, "Open With")
- `src/lib/tauri/watcher.ts` — Frontend file-changed handler with own-save suppression
- `src/routes/+page.svelte` — Main page, keyboard shortcuts, mode switching, render gating

### Backend
- `src-tauri/src/lib.rs` — Tauri setup: plugins, commands, menu, state, `OpenedFiles` buffer for "Open With"
- `src-tauri/src/commands.rs` — Rust IPC commands: `read_markdown_file`, `write_markdown_file`, `list_claude_plans`, `list_folder_md_files`, `quit_app` (used by close-on-ESC)
- `src-tauri/src/watcher.rs` — Rust file watcher (notify crate, watches parent dir)
- `src-tauri/src/menu.rs` — Native menu bar
- `src-tauri/tauri.conf.json` — Window config, file associations, CLI args, bundle settings
- `src-tauri/capabilities/default.json` — Tauri permissions (add new ones here when getting permission errors)
- `src-tauri/Info.plist` — macOS file type declarations for "Open With" / double-click support

## Things That Will Bite You

- **Tailwind v4 dark mode**: Uses `@custom-variant dark (&:where(.dark, .dark *))` in `app.css`. Without this, `dark:` utilities follow OS preference only and ignore the class toggle.
- **highlight.js languages**: Each language has to be registered explicitly in `pipeline.ts`. Unknown languages fall through `highlightAuto`. Adding new languages = `import` + `hljs.registerLanguage()`.
- **Svelte 5 runes mode**: No `afterUpdate` or `beforeUpdate`. Use `$effect` with `tick()` instead. Components use `$props()`, `$state()`, `$effect()`, `$derived()`.
- **Vite HMR watches everything**: Editing `.md` files inside the project triggers a full page reload, losing app state. The `vite.config.js` ignores `**/tests/**` and `**/src-tauri/**`. If users report files "closing" on save, check if Vite is watching that path.
- **Tauri permissions**: New IPC commands or webview APIs need explicit permissions in `src-tauri/capabilities/default.json`. Error messages include the required permission name (e.g. `core:window:allow-set-title`).
- **Atomic saves break file watchers**: Watching a file directly fails when editors delete + rename. That's why `watcher.rs` watches the parent directory and filters by filename.
- **Own-save reload loop**: Saving from the in-app editor triggers the file watcher. The frontend watcher suppresses reloads within 1.5s of `tab.lastSavedAt`. Bumping the suppression window or skipping `markSaved` will cause a phantom reload that wipes `editContent`.
- **DOMPurify strips SVG/MathML**: The sanitizer config in `pipeline.ts` has explicit `ADD_TAGS` and `ADD_ATTR` for KaTeX MathML elements and Mermaid SVG. If new rendered content gets stripped, add its tags/attrs there.
- **macOS Cmd+V in textareas**: Custom menus replace the default Edit menu. Without `PredefinedMenuItem::paste` in `menu.rs`, Cmd+V won't work in any text input. Always include Cut/Copy/Paste predefined items.
- **"Open With" fires before webview**: The `RunEvent::Opened` event arrives before the frontend loads. File paths are buffered in `OpenedFiles` state (Rust) and polled by the frontend on mount via `get_opened_files` command.
- **`paste://` and `url://` paths**: Tabs created from pasted markdown use `paste://`; URL-fetched tabs use `url://`. The watcher skips these (no file to watch). The Edit button is disabled for both (no save target). Don't add code paths that assume every tab has a real filesystem path.
- **Editor source-line sync limitation**: Source lines that visually wrap to multiple textarea rows are counted as one line. For typical markdown the drift is small. Long-prose paragraphs may be slightly off when entering/leaving the editor.
- **Editor uses `position: fixed`**: Sits at `top: 75px; bottom: 0; z-index: 1`. This guarantees a single scrollbar (the textarea's). Don't change this casually — without it, double scrollbars appear and source-line sync breaks (because user might scroll the window instead of the textarea).
- **Textarea binding**: Use `bind:value={localValue}` (two-way) on the editor textarea, not `value={x}` (one-way). One-way binding can desync the visible text from the property.
- **Update-check throttle**: `updater.ts` enforces a 24h gap via `lastUpdateCheck` in localStorage. The "Check for Updates…" menu and the test endpoint can pass `force=true` to bypass. The check is also skipped in dev (`import.meta.env.DEV`) unless forced. Bumping the throttle window or removing the dev guard will pollute aggregate DAU counters tracked by the `/api/version` endpoint.
- **DAU endpoint hygiene**: When curling `/api/version` for testing, always pass `?from=test&os=test` so the call lands in clearly-fake Upstash buckets instead of polluting real-version DAU stats. Real-looking values (e.g. `from=0.2.3&os=darwin`) silently masquerade as legitimate user traffic.
- **`quit_app` on macOS specifically**: The close-on-ESC feature must call the Rust `quit_app` command (`AppHandle::exit(0)`) — `getCurrentWindow().close()` won't actually quit; macOS keeps the app in the dock. Windows/Linux quit on window close, but the explicit exit keeps behavior consistent.
- **`mdhero.app/api/version` is the source of truth for "latest"**, defined in the sibling `mdhero-site` repo at `src/data/versions.ts`. After tagging a new release, bump that file and redeploy the site — otherwise the in-the-wild update banner stays on the old version. The response is cached at the Vercel edge for 5 minutes (`s-maxage=300`).

## Code Conventions

- Runtime: Rust (Tauri v2) + SvelteKit (Vite). Package manager: pnpm.
- Svelte 5 runes syntax throughout — `$state()`, `$props()`, `$effect()`, `$derived()`.
- Styling: Tailwind CSS v4 with `@tailwindcss/typography` prose classes. No separate CSS files for components — use `<style>` blocks with `:global()` for rendered markdown targeting.
- Stores: Svelte writable stores, not external state libraries.
- Tauri commands: defined in Rust with `#[tauri::command]`, called from frontend via `invoke()`.
- Non-blocking Tauri calls: `setTitle`, `start_watching`, and other non-critical IPC calls use `.catch(() => {})` to prevent failures from breaking the main flow.
- File structure: components in `src/lib/components/`, stores in `src/lib/stores/`, Tauri wrappers in `src/lib/tauri/`, rendering in `src/lib/renderer/`, helpers in `src/lib/utils/`.

## Issue tracking workflow

External GitHub Issues and Discussions that need design work get a private working notes doc in `docs/issues/` (gitignored). Naming: `issue-N-slug.md` and `discussion-N-slug.md`. Each doc captures: link to the issue, reporter, locked design decisions table, UX layouts, acceptance criteria, files to change, edge cases, out-of-scope items, and ship plan. Skip the doc for trivial bug fixes; create one when design needs more than a quick comment can carry.

## Release & distribution

- **Tag-driven CI**: pushing a `v*` tag triggers `.github/workflows/build.yml` → builds macOS (Apple Silicon) DMG + Windows EXE/MSI → publishes a GitHub Release.
- **macOS signing**: ad-hoc signed only (`bundle.macOS.signingIdentity: "-"` in `tauri.conf.json`). No Apple Developer ID (yet). Users get a "cannot be verified" Gatekeeper dialog on first launch; workaround is `xattr -cr /Applications/MDHero.app` or System Settings → Privacy & Security → Open Anyway. Without the explicit `signingIdentity` config, the linker-only signature is malformed and produces the harsher "MDHero is damaged" dialog with no workaround — don't remove that line.
- **Windows signing**: unsigned. Users get a SmartScreen warning workaround-able via "More info → Run anyway".
- **No Intel Mac build** (CI matrix is `macos-latest` only = arm64). Adding `x86_64-apple-darwin` to the matrix is on the roadmap.
- **Release flow** end-to-end: bump version in `package.json` + `tauri.conf.json` + `Cargo.toml` → commit → tag → push → CI builds → bump `mdhero-site/src/data/versions.ts` → commit + push site → write GitHub release notes via `gh release edit`.
