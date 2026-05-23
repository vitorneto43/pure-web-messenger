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
        dispatchCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchCallIntent(intent);
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
