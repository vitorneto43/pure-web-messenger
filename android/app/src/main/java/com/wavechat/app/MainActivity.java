package com.wavechat.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureFirebaseReady();
        CallAlertUtils.stopVibration(this);
        dispatchCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        CallAlertUtils.stopVibration(this);
        dispatchCallIntent(intent);
    }

    private void ensureFirebaseReady() {
        try {
            android.app.Application app = getApplication();
            if (app instanceof WaveChatApplication) {
                ((WaveChatApplication) app).initializeFirebase();
            } else if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
                com.google.firebase.FirebaseApp.initializeApp(this);
            }
        } catch (Exception ignored) {}
    }

    private void dispatchCallIntent(android.content.Intent intent) {
        if (intent == null || intent.getStringExtra("callId") == null) return;
        if (bridge == null) {
            handler.postDelayed(() -> dispatchCallIntent(intent), 350);
            return;
        }
        try {
            JSONObject data = new JSONObject();
            data.put("callId", intent.getStringExtra("callId"));
            data.put("action", intent.getStringExtra("action"));
            bridge.triggerWindowJSEvent("wavechat-android-intent", data.toString());
            bridge.eval("localStorage.setItem('wavechat_pending_call_intent', " + JSONObject.quote(data.toString()) + ")", null);
        } catch (Exception ignored) {}
    }
}
