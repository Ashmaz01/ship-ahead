package com.ashmaz.shipahead.volcanicmath;
import android.app.Activity;
import android.net.Uri;
import java.io.IOException;
import java.io.InputStream;
import android.os.Bundle;
import android.os.Build;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.webkit.*;
import android.widget.*;
public final class GameActivity extends Activity {
    private static final String HOST = "ship-ahead-volcano-isle.expertmagpie5.chatgpt.site";
    private WebView game;
    private LinearLayout root;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        if (Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            return insets;
        });
        game = new WebView(this);
        Button retry = new Button(this);
        retry.setText("Connection lost · Tap to retry");
        retry.setVisibility(Button.GONE);
        retry.setOnClickListener(v -> game.reload());
        root.addView(retry);
        root.addView(game,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setDomStorageEnabled(true);
        game.getSettings().setAllowFileAccess(false);
        game.getSettings().setAllowContentAccess(false);
        // Links with target="_blank" go through onCreateWindow; route them to shouldOverrideUrlLoading.
        game.getSettings().setSupportMultipleWindows(false);
        game.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getAuthority())) return null;
                String path = uri.getPath();
                if (path == null || path.startsWith("/api/")) return null;
                String asset = "/".equals(path) ? "index.html" : path.substring(1);
                if (!asset.matches("[A-Za-z0-9_./-]+") || asset.contains("..")) return missingAsset();
                try {
                    InputStream stream = getAssets().open("game/" + asset);
                    String extension = MimeTypeMap.getFileExtensionFromUrl(asset);
                    String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    if ("js".equals(extension)) mime = "text/javascript";
                    return new WebResourceResponse(mime == null ? "application/octet-stream" : mime, null,
                        200, "OK", java.util.Collections.singletonMap("Cache-Control", "no-store"), stream);
                } catch (IOException e) {
                    return missingAsset();
                }
            }
            private WebResourceResponse missingAsset() {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) {
                Uri url = r.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
                // Other https links, such as the privacy policy, open in the phone's browser.
                if ("https".equals(url.getScheme())) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, url)); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest r, WebResourceError err) {
                if (r.isForMainFrame()) retry.setVisibility(Button.VISIBLE);
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) {
                retry.setVisibility(Button.GONE);
            }
        });
        if (state == null || game.restoreState(state) == null) game.loadUrl("https://"+HOST+"/");
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); game.saveState(state); }
    @Override protected void onPause() { game.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); game.onResume(); }
}
