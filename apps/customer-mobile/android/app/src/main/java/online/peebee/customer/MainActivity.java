package online.peebee.customer;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private WebView popupWebView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView mainWebView = getBridge().getWebView();
        WebSettings settings = mainWebView.getSettings();
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Strip "; wv" from User-Agent so Google Identity Services allows embedded OAuth popups
        String ua = settings.getUserAgentString();
        if (ua != null) {
            final String cleanUa = ua.replace("; wv", "");
            settings.setUserAgentString(cleanUa);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(mainWebView, true);

        final String cleanUserAgent = settings.getUserAgentString();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (popupWebView != null) {
                    if (popupWebView.canGoBack()) {
                        popupWebView.goBack();
                    } else {
                        closePopupWebView();
                    }
                    return;
                }
                if (mainWebView.canGoBack()) {
                    mainWebView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        mainWebView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                closePopupWebView();

                popupWebView = new WebView(MainActivity.this);
                popupWebView.setLayoutParams(new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));

                WebSettings popupSettings = popupWebView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setSupportMultipleWindows(true);
                popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                if (cleanUserAgent != null) {
                    popupSettings.setUserAgentString(cleanUserAgent);
                }

                cookieManager.setAcceptThirdPartyCookies(popupWebView, true);

                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        return false;
                    }
                });

                popupWebView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public void onCloseWindow(WebView window) {
                        closePopupWebView();
                    }
                });

                ViewGroup rootLayout = findViewById(android.R.id.content);
                rootLayout.addView(popupWebView);

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                closePopupWebView();
            }
        });
    }

    private void closePopupWebView() {
        if (popupWebView != null) {
            ViewGroup parent = (ViewGroup) popupWebView.getParent();
            if (parent != null) {
                parent.removeView(popupWebView);
            }
            popupWebView.destroy();
            popupWebView = null;
        }
    }
}
