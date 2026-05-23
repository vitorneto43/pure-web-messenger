package com.wavechat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String callId = intent.getStringExtra("callId");
        String action = intent.getStringExtra("action");

        CallAlertUtils.stopAllCallAlerts(context, callId);
        context.startActivity(CallAlertUtils.mainActivityIntent(context, callId, action));
    }
}