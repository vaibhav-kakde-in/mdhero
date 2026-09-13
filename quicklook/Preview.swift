import Cocoa
import Quartz
import WebKit

/// Quick Look preview for Markdown documents.
///
/// The extension itself is deliberately thin: it reads the file, hands the text
/// to `preview.html` (the bundled build of the app's own renderer) and waits for
/// that page to say it has painted. All markdown handling — parsing,
/// sanitizing, highlighting, diagrams — lives in the shared TypeScript
/// pipeline, so Quick Look cannot drift away from what the app shows.
///
/// #security: this renders a document of unknown provenance inside an extension
/// that must hold `com.apple.security.network.client` (WKWebView does not
/// finish loading without it). Tauri's CSP header does not reach here, so the
/// policy baked into preview.html is the only egress control on this path.
@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController,
                                   WKNavigationDelegate, WKScriptMessageHandler {

    /// Quick Look renders the view as soon as the completion handler fires, so
    /// it is held until the page reports that it has actually painted.
    /// Releasing it early is what produces a blank preview.
    private var pending: ((Error?) -> Void)?
    private var webView: WKWebView!
    /// Set immediately before the one `loadHTMLString` this view ever performs,
    /// and consumed by the navigation policy below. See `decidePolicyFor`.
    private var expectingInitialLoad = false

    // MARK: - View

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 800, height: 600))

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "mdheroReady")
        config.userContentController.add(self, name: "mdheroError")

        webView = WKWebView(frame: container.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        // Let Quick Look's own backdrop show through, as the app does.
        webView.setValue(false, forKey: "drawsBackground")

        container.addSubview(webView)
        view = container
    }

    private var prefersDark: Bool {
        view.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    }

    // MARK: - QLPreviewingController

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        pending = handler
        do {
            let html = try page(for: url)
            expectingInitialLoad = true
            webView.loadHTMLString(html, baseURL: nil)
        } catch {
            NSLog("MDHeroQuickLook: %@", error.localizedDescription)
            pending = nil
            handler(error)
        }
    }

    /// Builds the HTML for one preview: the bundled renderer, a per-preview CSP
    /// nonce, and a boot script carrying the document text.
    private func page(for url: URL) throws -> String {
        let markdown = try String(contentsOf: url, encoding: .utf8)

        guard let template = Bundle.main.url(forResource: "preview", withExtension: "html") else {
            throw NSError(domain: "MDHeroQuickLook", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "preview.html is missing from the extension bundle",
            ])
        }
        var html = try String(contentsOf: template, encoding: .utf8)

        // #security: a fresh nonce per preview. preview.html's script-src is
        // nonce-based rather than 'unsafe-inline', so a script that somehow
        // survived the sanitizer still cannot execute.
        let nonce = try Self.makeNonce()
        html = html.replacingOccurrences(of: "__CSP_NONCE__", with: nonce)

        // Substitution happens at unique tokens, never at `</head>` or
        // `</body>`. The bundled renderer's own minified source contains those
        // strings (DOMPurify builds document fragments); replacing them injects
        // a `</script>` INSIDE the bundle, truncating it mid-file and spilling
        // the remainder onto the page as text.
        html = html.replacingOccurrences(of: "__MDHERO_PRELUDE__", with: prelude(nonce: nonce))
        html = html.replacingOccurrences(of: "__MDHERO_BOOT__",
                                         with: boot(nonce: nonce, markdown: markdown))
        return html
    }

    /// Installed before the renderer so a failure inside it is still reported.
    /// A `loadHTMLString` document has an opaque origin, which reduces
    /// `window.onerror` to a bare "Script error." — hence the explicit bridge.
    private func prelude(nonce: String) -> String {
        """
        <script nonce="\(nonce)">
        var __mdheroReport = function (m) {
          try { window.webkit.messageHandlers.mdheroError.postMessage(String(m)); } catch (e) {}
        };
        window.onerror = function (m, s, l, c) { __mdheroReport(m + " @" + l + ":" + c); };
        window.onunhandledrejection = function (e) {
          __mdheroReport("unhandled rejection: " + ((e.reason && e.reason.message) || e.reason));
        };
        document.addEventListener("securitypolicyviolation", function (e) {
          __mdheroReport("CSP blocked " + e.violatedDirective + " <- " + e.blockedURI);
        });
        </script>
        """
    }

    private func boot(nonce: String, markdown: String) -> String {
        """
        <script nonce="\(nonce)">
        window.__mdheroRender(\(Self.jsString(markdown)), \(prefersDark))
          .catch(function (e) { __mdheroReport("render failed: " + e); });
        </script>
        """
    }

    // MARK: - Helpers

    /// #security: a failed draw must not silently yield 16 zero bytes — that
    /// would make the CSP nonce predictable, which is the one property it has.
    private static func makeNonce() throws -> String {
        var bytes = Data(count: 16)
        let status = bytes.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!)
        }
        guard status == errSecSuccess else {
            throw NSError(domain: "MDHeroQuickLook", code: Int(status), userInfo: [
                NSLocalizedDescriptionKey: "could not generate a CSP nonce (SecRandomCopyBytes \(status))",
            ])
        }
        return bytes.base64EncodedString().replacingOccurrences(of: "=", with: "")
    }

    /// A JS string literal for arbitrary document text. JSON handles quoting and
    /// control characters; `<` is escaped as well so no document content can
    /// close the surrounding `<script>` element.
    private static func jsString(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s]),
              let json = String(data: data, encoding: .utf8) else { return "\"\"" }
        return String(json.dropFirst().dropLast())
            .replacingOccurrences(of: "<", with: "\\u003C")
    }

    // MARK: - Delegates

    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        switch message.name {
        case "mdheroReady":
            pending?(nil)
            pending = nil
        case "mdheroError":
            NSLog("MDHeroQuickLook: %@", String(describing: message.body))
        default:
            break
        }
    }

    /// #security: a preview is a viewer, not a browser. Only the in-memory
    /// document this controller loads is allowed to navigate.
    ///
    /// The CSP stops script, forms and `base-uri`, but no CSP directive stops a
    /// plain link click — and DOMPurify quite correctly leaves `https:` links
    /// in the document. Following one would navigate this web view out to an
    /// attacker-chosen URL from a process holding
    /// `com.apple.security.network.client`, turning any previewed file into a
    /// beacon: the reader's IP, the time, and the fact that this document was
    /// opened. Links are therefore dead in the preview; open the file in MDHero
    /// to follow them.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if expectingInitialLoad, navigationAction.navigationType == .other {
            expectingInitialLoad = false
            decisionHandler(.allow)
            return
        }
        NSLog("MDHeroQuickLook: blocked navigation to %@",
              navigationAction.request.url?.absoluteString ?? "(none)")
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Backstop: show whatever painted rather than leaving Quick Look hanging
        // if the renderer never reports in.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, self.pending != nil else { return }
            NSLog("MDHeroQuickLook: renderer did not report ready; releasing anyway")
            self.pending?(nil)
            self.pending = nil
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        pending?(error)
        pending = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        pending?(error)
        pending = nil
    }
}
