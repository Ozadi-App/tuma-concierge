import UIKit
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

@objc(BridgeViewController)
class BridgeViewController: CAPBridgeViewController, WKUIDelegate {

    private weak var originalUIDelegate: WKUIDelegate?
    private var popupContainer: UIView?
    private var popupWebView: WKWebView?

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // Identify as Mobile Safari so Google Identity Services allows embedded OAuth popups
        configuration.applicationNameForUserAgent = "Version/17.0 Mobile/15E148 Safari/604.1"
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        originalUIDelegate = webView?.uiDelegate
        webView?.uiDelegate = self
        webView?.allowsBackForwardNavigationGestures = true
    }

    // MARK: - WKUIDelegate (OAuth / popup window support)

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           ["tel", "mailto", "sms", "whatsapp", "maps"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return nil
        }

        closePopupWebView()

        let container = UIView(frame: view.bounds)
        container.backgroundColor = .systemBackground
        container.translatesAutoresizingMaskIntoConstraints = false

        let headerBar = UIView()
        headerBar.backgroundColor = .secondarySystemBackground
        headerBar.translatesAutoresizingMaskIntoConstraints = false

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        closeButton.addTarget(self, action: #selector(handleClosePopupTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false

        let popup = WKWebView(frame: .zero, configuration: configuration)
        popup.translatesAutoresizingMaskIntoConstraints = false
        popup.uiDelegate = self
        popup.allowsBackForwardNavigationGestures = true
        if let customUA = webView.customUserAgent, !customUA.isEmpty {
            popup.customUserAgent = customUA
        }

        headerBar.addSubview(closeButton)
        container.addSubview(headerBar)
        container.addSubview(popup)
        view.addSubview(container)

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: view.topAnchor),
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            container.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            headerBar.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
            headerBar.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            headerBar.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            headerBar.heightAnchor.constraint(equalToConstant: 44),

            closeButton.centerYAnchor.constraint(equalTo: headerBar.centerYAnchor),
            closeButton.trailingAnchor.constraint(equalTo: headerBar.trailingAnchor, constant: -16),

            popup.topAnchor.constraint(equalTo: headerBar.bottomAnchor),
            popup.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            popup.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            popup.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        popupContainer = container
        popupWebView = popup
        return popup
    }

    func webViewDidClose(_ webView: WKWebView) {
        if webView == popupWebView {
            closePopupWebView()
        }
    }

    @objc private func handleClosePopupTapped() {
        closePopupWebView()
    }

    private func closePopupWebView() {
        popupWebView?.stopLoading()
        popupWebView?.uiDelegate = nil
        popupWebView?.removeFromSuperview()
        popupWebView = nil

        popupContainer?.removeFromSuperview()
        popupContainer = nil
    }

    // MARK: - Forward standard WKUIDelegate dialogs & permissions to Capacitor

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        if let delegate = originalUIDelegate,
           delegate.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptAlertPanelWithMessage:initiatedByFrame:completionHandler:))) {
            delegate.webView?(webView, runJavaScriptAlertPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        if let delegate = originalUIDelegate,
           delegate.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptConfirmPanelWithMessage:initiatedByFrame:completionHandler:))) {
            delegate.webView?(webView, runJavaScriptConfirmPanelWithMessage: message, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(false)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        if let delegate = originalUIDelegate,
           delegate.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:))) {
            delegate.webView?(webView, runJavaScriptTextInputPanelWithPrompt: prompt, defaultText: defaultText, initiatedByFrame: frame, completionHandler: completionHandler)
        } else {
            completionHandler(nil)
        }
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }
}
