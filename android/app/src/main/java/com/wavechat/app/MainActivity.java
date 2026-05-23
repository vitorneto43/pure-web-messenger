package com.wavechat.app;

import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchCallIntent(intent);
    }

    private void dispatchCallIntent(android.content.Intent intent) {
        if (bridge == null || intent == null || intent.getStringExtra("callId") == null) return;
        try {
            JSONObject data = new JSONObject();
            data.put("callId", intent.getStringExtra("callId"));
            data.put("action", intent.getStringExtra("action"));
            bridge.triggerWindowJSEvent("wavechat-android-intent", data.toString());
            bridge.eval("localStorage.setItem('wavechat_pending_call_intent', " + JSONObject.quote(data.toString()) + ")", null);
        } catch (Exception ignored) {}
    }
}
