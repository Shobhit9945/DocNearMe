import SwiftUI
import WebKit

struct RecaptchaWebView: UIViewRepresentable {
    let siteKey: String
    let onVerify: (String) -> Void
    let onExpire: () -> Void
    let onError: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "recaptcha")
        configuration.userContentController = controller
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.isScrollEnabled = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.loadHTMLString(htmlString, baseURL: URL(string: "https://www.google.com"))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.parent = self
    }

    private var htmlString: String {
        let escapedKey = siteKey.replacingOccurrences(of: "\"", with: "\\\"")
        return """
        <!doctype html>
        <html>
          <head>
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
            <script src=\"https://www.google.com/recaptcha/api.js?onload=onloadCallback&render=explicit\" async defer></script>
            <style>
              html, body { margin: 0; padding: 0; background: transparent; }
              #recaptcha-container { transform: scale(0.9); transform-origin: 0 0; }
            </style>
            <script>
              var widgetId = null;
              function onloadCallback() {
                widgetId = grecaptcha.render('recaptcha-container', {
                  'sitekey': '\(escapedKey)',
                  'callback': onVerify,
                  'expired-callback': onExpired,
                  'error-callback': onError
                });
              }
              function onVerify(token) {
                window.webkit.messageHandlers.recaptcha.postMessage({ type: 'verify', token: token });
              }
              function onExpired() {
                window.webkit.messageHandlers.recaptcha.postMessage({ type: 'expired' });
              }
              function onError() {
                window.webkit.messageHandlers.recaptcha.postMessage({ type: 'error' });
              }
            </script>
          </head>
          <body>
            <div id=\"recaptcha-container\"></div>
          </body>
        </html>
        """
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var parent: RecaptchaWebView

        init(_ parent: RecaptchaWebView) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "recaptcha" else { return }
            if let body = message.body as? [String: Any],
               let type = body["type"] as? String {
                switch type {
                case "verify":
                    if let token = body["token"] as? String {
                        parent.onVerify(token)
                    }
                case "expired":
                    parent.onExpire()
                case "error":
                    parent.onError()
                default:
                    break
                }
            }
        }
    }
}
