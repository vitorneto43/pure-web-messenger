package com.wavechat.app;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;

public class IncomingCallActivity extends Activity {
    private static WeakReference<IncomingCallActivity> currentActivity;
    private String callId;
    private String callerName;
    private String kind;
    private final BroadcastReceiver callEndedReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String endedCallId = intent.getStringExtra("callId");
            if (callId == null || callId.equals(endedCallId)) finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentActivity = new WeakReference<>(this);
        configureWindow();
        readExtras();
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.startCallRingtone(this);
        CallAlertUtils.startCallVibration(this);
        CallAlertUtils.watchCallStatus(this, callId);
        setContentView(buildLayout());
        registerCallEndedReceiver();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        currentActivity = new WeakReference<>(this);
        setIntent(intent);
        readExtras();
        CallAlertUtils.startCallRingtone(this);
        CallAlertUtils.startCallVibration(this);
        CallAlertUtils.watchCallStatus(this, callId);
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(callEndedReceiver);
        } catch (Exception ignored) {}
        IncomingCallActivity current = currentActivity == null ? null : currentActivity.get();
        if (current == this) currentActivity = null;
        CallStatusPoller.stop(callId);
        super.onDestroy();
    }

    public static void finishCallScreen(String endedCallId) {
        IncomingCallActivity activity = currentActivity == null ? null : currentActivity.get();
        if (activity == null) return;
        if (activity.callId == null || activity.callId.equals(endedCallId)) {
            activity.runOnUiThread(activity::finish);
        }
    }

    private void registerCallEndedReceiver() {
        IntentFilter filter = new IntentFilter("com.wavechat.app.CALL_ALERT_ENDED");
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(callEndedReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(callEndedReceiver, filter);
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.requestFeature(Window.FEATURE_NO_TITLE);
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    private void readExtras() {
        android.content.Intent intent = getIntent();
        callId = intent.getStringExtra("callId");
        callerName = intent.getStringExtra("callerName");
        kind = intent.getStringExtra("kind");
        if (callerName == null || callerName.trim().isEmpty()) callerName = "Alguém";
        if (kind == null || kind.trim().isEmpty()) kind = "audio";
    }

    private View buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 80, 48, 80);
        root.setBackgroundColor(android.graphics.Color.rgb(7, 32, 46));

        TextView title = new TextView(this);
        title.setText(kind.equals("video") ? "Chamada de vídeo" : "Chamada de voz");
        title.setTextColor(android.graphics.Color.rgb(190, 220, 232));
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);

        TextView name = new TextView(this);
        name.setText(callerName);
        name.setTextColor(android.graphics.Color.WHITE);
        name.setTextSize(34);
        name.setGravity(Gravity.CENTER);
        name.setPadding(0, 24, 0, 64);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);

        Button decline = new Button(this);
        decline.setText("Recusar");
        decline.setTextColor(android.graphics.Color.WHITE);
        decline.setBackgroundColor(android.graphics.Color.rgb(220, 38, 38));
        decline.setOnClickListener((v) -> finishWithAction("decline"));

        Button accept = new Button(this);
        accept.setText("Atender");
        accept.setTextColor(android.graphics.Color.WHITE);
        accept.setBackgroundColor(android.graphics.Color.rgb(22, 163, 74));
        accept.setOnClickListener((v) -> finishWithAction("accept"));

        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(260, 120);
        buttonParams.setMargins(18, 0, 18, 0);
        actions.addView(decline, buttonParams);
        actions.addView(accept, buttonParams);

        root.addView(title, new LinearLayout.LayoutParams(-1, -2));
        root.addView(name, new LinearLayout.LayoutParams(-1, -2));
        root.addView(actions, new LinearLayout.LayoutParams(-1, -2));
        return root;
    }

    private void finishWithAction(String action) {
        CallAlertUtils.stopAllCallAlerts(this, callId);
        startActivity(CallAlertUtils.mainActivityIntent(this, callId, action));
        finish();
    }
}