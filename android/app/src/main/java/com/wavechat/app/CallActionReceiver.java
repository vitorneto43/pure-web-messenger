package com.wavechat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String callId = intent.getStringExtra("callId");
        String action = intent.getStringExtra("action");

        // Stop ringtone, notification, foreground service and any vibration before opening the app.
        // This is essential on older Android devices, where vibration may otherwise survive the UI transition.
        CallAlertUtils.stopAllCallAlerts(context, callId);
        WaveChatTelecomManager.endIncomingCall(context, callId);
        context.startActivity(CallAlertUtils.mainActivityIntent(context, callId, action));
    }
}