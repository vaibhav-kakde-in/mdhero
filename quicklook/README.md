# MDHero Quick Look extension (macOS)

Select a `.md` file in Finder, press Space, see it rendered. Issue #88.

The extension is a macOS app extension (`.appex`) that ships inside
`MDHero.app/Contents/PlugIns/`. MDHero must be installed for macOS to register
it, but does not have to be running.

## How it is put together

| Piece | Where | What it does |
|---|---|---|
| `Preview.swift` | here | ~170 lines. Reads the file, hands the text to a web view, waits for it to paint. No markdown logic. |
| `preview.html` | generated | The app's **own** renderer, built standalone and fully inlined. |
| `src/quicklook/preview.ts` | frontend | Entry point; imports `renderer/pipeline.ts` verbatim. |
| `scripts/build-quicklook.mjs` | repo root | Bundles the above into one self-contained HTML file. |
| `build-appex.sh` | here | Compiles, assembles and signs the `.appex`. |

The point of that split: Quick Look is a second **host** for the existing
renderer, not a second renderer. `preview.ts` imports `pipeline.ts` directly,
and `build-quicklook.mjs` extracts `MarkdownRenderer.svelte`'s `<style>` block
at build time, so neither the parsing nor the styling can drift from the app.

## Building it

```bash
pnpm quicklook:appex                       # ad-hoc signed, for local testing
APPLE_SIGNING_IDENTITY="Developer ID Application: …" pnpm quicklook:appex
```

To produce an app with the extension embedded, the extension must exist first:

```bash
pnpm quicklook:appex
pnpm tauri build --config src-tauri/tauri.quicklook.conf.json
```

That overlay is deliberately **not** part of `tauri.conf.json`: the bundler
errors if a file named in `bundle.macOS.files` is missing, so folding it into the
base config would break `pnpm tauri build` for anyone who has not built the
extension. CI applies the overlay on macOS only.

## Testing it without installing to /Applications

macOS registers an extension through its **host app**, so a bare `.appex` on its
own is not discoverable — `pluginkit -a` will exit 0 and register nothing. Build
the app with the extension embedded, tell Launch Services about it, then
register:

```bash
pnpm quicklook:appex
pnpm tauri build --debug --bundles app --config src-tauri/tauri.quicklook.conf.json

APP="src-tauri/target/debug/bundle/macos/MDHero.app"
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$LSREG" -f "$APP"
pluginkit -a "$PWD/$APP/Contents/PlugIns/MDHeroQuickLook.appex"

qlmanage -p some-file.md          # preview it
pluginkit -m -v -p com.apple.quicklook.preview | grep mdhero   # confirm it registered
pluginkit -r "$PWD/$APP/Contents/PlugIns/MDHeroQuickLook.appex" # unregister when done
```

Re-run `lsregister -f` after each rebuild of the app bundle; otherwise pluginkit
keeps pointing at the bundle it saw last.

The extension logs to the unified log. This is the fastest way to see what it
did:

```bash
log stream --predicate 'eventMessage CONTAINS "MDHeroQuickLook"' --style compact
```

## Things that will bite you

These are all confirmed on a real build, not guesses.

**The sandbox is mandatory and it grants exactly one file.** Signed without
`com.apple.security.app-sandbox`, macOS refuses to load the extension at all —
no process, no log output, silence. And the host hands over the previewed file
only: reading a *sibling* in the same folder is denied. That is why **relative
images do not render in Quick Look** and cannot be made to.

**WKWebView needs `com.apple.security.network.client` or the preview is blank.**
Without it, navigation simply never completes: `preparePreviewOfFile` runs, the
file reads fine, and `didFinish` never fires. The kernel says why —
`deny file-read-data /Library/Preferences/com.apple.networkd.plist` and
`deny mach-lookup com.apple.webprivacyd`. Nothing is actually fetched;
`preview.html` is self-contained and its CSP sets `connect-src 'none'`.

**Release the completion handler only when the page has painted.** Quick Look
renders the view the instant the handler fires, so calling it right after
`loadHTMLString` captures a blank web view.

**Never substitute into the HTML at `</head>` or `</body>`.** The bundled
renderer's minified source contains both strings (DOMPurify builds document
fragments). Replacing them injects a `<script>` — and its `</script>` — *inside*
the bundle, truncating it mid-file and spilling the rest onto the page as
visible text. Use the `__MDHERO_PRELUDE__` / `__MDHERO_BOOT__` tokens. The same
hazard is why `build-quicklook.mjs` escapes `<!--` as `\x3C!--` before inlining.

**Debugging it is deliberately awkward.** A `loadHTMLString` document has an
opaque origin, so `window.onerror` reduces every real error to `"Script error."`.
The extension installs an explicit error bridge for that reason. When something
is wrong and the log is quiet, `evaluateJavaScript` returning
`document.scripts[i].textContent.length` is usually what tells you the truth.
