package com.wavechat.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    private String callId;
    private String callerName;
    private String kind;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        readExtras();
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.stopVibration(this);
        setContentView(buildLayout());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readExtras();
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