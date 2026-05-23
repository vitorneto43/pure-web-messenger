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
}