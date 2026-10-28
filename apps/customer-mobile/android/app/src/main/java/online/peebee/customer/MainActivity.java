package online.peebee.customer;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String GOOGLE_WEB_CLIENT_ID =
        "800078968934-7va1llsnhh3rdegsk6k65sq59iligtsg.apps.googleusercontent.com";

    private WebView popupWebView;
    private GoogleSignInClient googleSignInClient;
    private ActivityResultLauncher<Intent> googleSignInLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .requestIdToken(GOOGLE_WEB_CLIENT_ID)
            .build();
        googleSignInClient = GoogleSignIn.getClient(this, gso);

        googleSignInLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
                try {
                    GoogleSignInAccount account = task.getResult(ApiException.class);
                    String idToken = account != null ? account.getIdToken() : null;
                    if (idToken != null && !idToken.isEmpty()) {
                        closePopupWebView();
                        completeGoogleSignInInWebView(idToken);
                        return;
                    }
                } catch (ApiException e) {
                    if (e.getStatusCode() == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                        closePopupWebView();
                        return;
                    }
                    // Status 10 (DEVELOPER_ERROR) or 12500: Android OAuth Client SHA-1 not added yet.
                    // Fall back to the preloaded popup WebView so sign-in still works.
                }
                if (popupWebView != null) {
                    popupWebView.setVisibility(View.VISIBLE);
                }
            }
        );

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
            public android.graphics.Bitmap getDefaultVideoPoster() {
                // Transparent 1x1 pixel so empty <video> elements don't show Android WebView's giant play icon
                return android.graphics.Bitmap.createBitmap(1, 1, android.graphics.Bitmap.Config.ARGB_8888);
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                closePopupWebView();

                popupWebView = new WebView(MainActivity.this);
                popupWebView.setLayoutParams(new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));
                // Start invisible while Native Android Google Sign-In picker launches first
                popupWebView.setVisibility(View.INVISIBLE);

                WebSettings popupSettings = popupWebView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setSupportMultipleWindows(false);
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

                    @Override
                    public void onPageFinished(WebView v, String url) {
                        super.onPageFinished(v, url);
                        cookieManager.flush();
                    }
                });

                // Use plain WebChromeClient here — BridgeWebChromeClient registers ActivityResultLaunchers
                // in its constructor, which throws IllegalStateException when called after onCreate/onStart!
                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        cookieManager.flush();
                        closePopupWebView();
                    }
                });

                ViewGroup rootLayout = findViewById(android.R.id.content);
                rootLayout.addView(popupWebView);

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();

                // Launch Android's native account picker (uses the Google accounts already signed in on the phone)
                googleSignInClient.signOut().addOnCompleteListener(task -> {
                    try {
                        googleSignInLauncher.launch(googleSignInClient.getSignInIntent());
                    } catch (Exception e) {
                        if (popupWebView != null) {
                            popupWebView.setVisibility(View.VISIBLE);
                        }
                    }
                });

                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                cookieManager.flush();
                closePopupWebView();
            }
        });
    }

    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    private void completeGoogleSignInInWebView(String idToken) {
        WebView mainWebView = getBridge().getWebView();
        if (mainWebView == null) return;
        String escapedToken = JSONObject.quote(idToken);
        String js = "(async function() {"
            + "try {"
            + "  const res = await fetch('https://api.peebee.online/v1/auth/google', {"
            + "    method: 'POST',"
            + "    headers: { 'Content-Type': 'application/json' },"
            + "    body: JSON.stringify({ idToken: " + escapedToken + ", role: 'customer' })"
            + "  });"
            + "  const data = await res.json();"
            + "  if (!res.ok) throw new Error(data.error || 'Google sign-in failed');"
            + "  localStorage.setItem('peebee_customer_token', data.token);"
            + "  localStorage.setItem('peebee_customer_user', JSON.stringify(data.user));"
            + "  window.location.replace('/');"
            + "} catch (e) {"
            + "  alert(e && e.message ? e.message : 'Google sign-in failed');"
            + "}"
            + "})();";
        mainWebView.post(() -> mainWebView.evaluateJavascript(js, null));
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
