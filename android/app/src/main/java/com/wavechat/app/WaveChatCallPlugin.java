package com.wavechat.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WaveChatCall")
public class WaveChatCallPlugin extends Plugin {
    @PluginMethod
    public void stopAlerts(PluginCall call) {
        String callId = call.getString("callId", null);
        CallAlertUtils.stopAllCallAlerts(getContext(), callId);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        String callId = call.getString("callId", null);
        // Hard stop: tear down the foreground service AND all alert sources
        // (ringtone, vibration, notification, telecom, incoming-call activity).
        // Without this, on MIUI / HyperOS (POCO X6) the foreground service may
        // keep the Ringtone alive after the user taps "Recusar".
        CallAlertUtils.stopAllCallAlerts(getContext(), callId);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void configureAudio(PluginCall call) {
        CallAlertUtils.configureInCallAudio(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void resetAudio(PluginCall call) {
        CallAlertUtils.resetInCallAudio(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        CallAlertUtils.setSpeakerphone(getContext(), on);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setBadge(PluginCall call) {
        int count = call.getInt("count", 0);
        try {
            me.leolin.shortcutbadger.ShortcutBadger.applyCount(getContext(), count);
        } catch (Exception ignored) {}
        // Also dismiss any delivered push notifications so launchers that count
        // active notifications (stock Android, Pixel) drop the dot as well.
        if (count <= 0) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager)
                    getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancelAll();
            } catch (Exception ignored) {}
        }
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}