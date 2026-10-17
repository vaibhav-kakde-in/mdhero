# Contributing to MDHero

Thanks for your interest in MDHero! This is a side project, so response times may vary — but contributions are very welcome.

---

## Ways to Contribute

- **Report bugs** — Open an issue with clear reproduction steps and your OS/version.
- **Suggest features** — Open an issue describing the problem you're solving (not just the solution).
- **Submit PRs** — Bug fixes are welcome anytime. For features, please open an issue first to discuss.
- **Improve docs** — README, keyboard shortcuts, install instructions — PRs for typos and clarifications are always welcome.

---

## Before You Start a Large PR

**Please open an issue first.** This saves everyone time:

- The feature may already be in progress
- It may not fit the project's direction
- We can discuss the approach before you write code

Small PRs (bug fixes, typos, minor tweaks) don't need an issue first.

---

## Development Setup

### Requirements
- **Node.js** 22+
- **pnpm** 10+
- **Rust** stable toolchain
- **Xcode Command Line Tools** (macOS) or **MSVC Build Tools** (Windows)

### Setup

```bash
# Clone
git clone https://github.com/vaibhav-kakde-in/mdhero.git
cd mdhero

# Install dependencies
pnpm install

# Run dev server with hot reload
pnpm tauri dev
```

Port 1420 is used for dev. If it's stuck, free it with:
```bash
lsof -ti:1420 | xargs kill -9
```

### Common Commands

```bash
pnpm tauri dev          # Dev with hot reload (frontend + Rust)
pnpm tauri build        # Production build (outputs DMG/MSI)
pnpm build              # Build frontend only (SvelteKit static)
pnpm check              # TypeScript type checking
```

---

## Code Style

### General
- **Keep changes focused.** Don't bundle unrelated changes in one PR.
- **Match existing patterns.** Read nearby code before introducing new conventions.
- **Prefer editing over creating.** Only add new files when there's a clear reason.
- **No unnecessary abstractions.** Three similar lines is better than a premature abstraction.

### Frontend (Svelte / TypeScript)
- Svelte 5 runes syntax: `$state()`, `$props()`, `$effect()`, `$derived()`. No legacy APIs.
- Tailwind CSS v4 — use utility classes; reserve `<style>` blocks for `:global()` markdown targeting.
- TypeScript strict mode. Avoid `any` unless interfacing with untyped external code.
- No external state libraries — use Svelte stores.

### Translations
- UI text lives in `src/lib/i18n/locales/*.json`, with `en.json` as the source. Use `{$t("section.key")}` in templates and `translate("section.key")` in event handlers.
- Add each new key to every locale file; a machine translation is fine as a start. `tests/unit/i18n.test.ts` fails when a locale is missing a key or a `{placeholder}`.

### Backend (Rust / Tauri)
- Tauri v2 commands via `#[tauri::command]`.
- New IPC commands need matching permissions in `src-tauri/capabilities/default.json`.
- Non-critical Tauri calls should use `.catch(() => {})` on the frontend to prevent failures from breaking the main flow.

### Comments
- **Default to writing no comments.** Only add a comment when the *why* is non-obvious.
- Don't explain what the code does — well-named identifiers already do that.

---

## Architecture Overview

```
src/
├── lib/
│   ├── components/   # Svelte components
│   ├── stores/       # Svelte writable stores (document, tabs, theme, etc.)
│   ├── renderer/     # markdown-it + highlight.js + KaTeX pipeline
│   ├── tauri/        # IPC wrappers (file ops, watcher)
│   └── utils/        # Helpers (llm parsing, url conversion)
└── routes/
    └── +page.svelte  # Main page, handles tabs + keyboard shortcuts

src-tauri/
├── src/
│   ├── lib.rs        # Tauri setup, plugins, state
│   ├── commands.rs   # IPC command handlers
│   ├── menu.rs       # Native menu bar
│   └── watcher.rs    # File watcher (notify crate)
├── tauri.conf.json   # Window/bundle/plugin config
└── capabilities/     # Tauri permissions
```

---

## Testing Your Changes

Before submitting a PR:

1. **Type check:** `pnpm check` passes
2. **Build:** `pnpm tauri build` succeeds on your platform
3. **Manual test:** Use the feature in dev mode, test edge cases, verify in both light and dark mode
4. **No regressions:** Confirm existing features (file open, tabs, search, etc.) still work

---

## Commit Messages

- Write clear, descriptive commit messages
- Focus on *why* the change was made, not *what* (the diff shows what)
- Reference issue numbers when applicable: `Fix race condition on file open (#42)`
- Keep the first line under 72 characters

---

## Security

If you find a security issue, please email **vaibhavuk.dev@gmail.com** instead of opening a public issue.

### Invariants — please don't undo these

MDHero opens `.md` files of unknown provenance: downloads, email attachments,
shared repos, `mdhero://` links. **A markdown document is untrusted input.** The
controls below were added in response to a real disclosure, and each one is easy
to remove by accident while doing something otherwise reasonable.

Each has a test behind it, so CI will stop you. But a test can only tell you
*that* you broke something — this table is the *why*.

| Please don't | Why | Caught by |
|---|---|---|
| Change Mermaid's `securityLevel: "strict"` | `"loose"` lets diagram source bind JavaScript and URLs to `click` nodes | `quicklook-bundle.test.ts` |
| Remove `DOMPurify.sanitize()` before the SVG reaches `innerHTML` | Mermaid's output is derived from the document; this is the only sanitizer on that path | `quicklook-bundle.test.ts` |
| Add `FORBID_TAGS: ["foreignObject"]` | Looks like obvious hardening. **Empties every diagram's labels** | re-render the diagrams and you'll see it |
| Unpin DOMPurify from `~3.3.3` | 3.4 strips HTML inside `<foreignObject>`; `journey` diagrams break first | `dompurify-pin.test.ts` |
| Set `security.csp` back to `null`, or wildcard `connect-src` | It *was* `null` once. `script-src 'self'` is what stops an injected script executing | `quicklook-bundle.test.ts` |
| Remove `has_allowed_extension` in `commands.rs`, or widen `ALLOWED_TEXT_EXTENSIONS` | These commands are callable from any JS in the webview — the guard is what stops them being an arbitrary file read/write | `fs_scope_tests` |
| Widen `assetProtocol.scope.allow` beyond the document's tree | `allow_assets` is the only route in, deliberately | `partition_assets` tests |
| Add an extension to `opener:allow-open-path` | Widens what any JS can hand to the OS. Executable, archive and document-macro types were excluded on purpose | `opener-capability.test.ts` |

**The Quick Look extension (`quicklook/`) is a second *host* for the renderer,
not a second renderer.** It reuses `renderer/pipeline.ts` verbatim and must keep
doing so. Its CSP is baked into the generated `preview.html`, because Tauri's
header-based policy does not exist inside an `.appex`. Remote images deliberately
do not load there — a decision, not a gap.

Two traps worth knowing before you test:

- **`pnpm tauri dev` applies no CSP at all.** Tauri serves it as a header from
  the embedded-asset protocol, so a broken policy passes cleanly in dev. Test CSP
  changes with `pnpm tauri build --debug --no-bundle`.
- **A green suite is not evidence for a sanitizer change.** Render an actual
  payload and assert nothing executed, and re-render every Mermaid diagram type —
  each is a separate render path.

If one of these blocks something you need, say so in the issue or PR. They are
deliberate, not sacred — they just get changed on purpose, with evidence, rather
than as a side effect.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
