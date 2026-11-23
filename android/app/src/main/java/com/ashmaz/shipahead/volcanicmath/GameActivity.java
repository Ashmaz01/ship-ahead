package com.ashmaz.shipahead.volcanicmath;
import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.webkit.*;
import android.widget.*;
public final class GameActivity extends Activity {
    private static final String HOST = "ship-ahead-volcano-isle.expertmagpie5.chatgpt.site";
    private WebView game;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        LinearLayout root = new LinearLayout(this);
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
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) {
                return !"https".equals(r.getUrl().getScheme()) || !HOST.equals(r.getUrl().getHost());
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
