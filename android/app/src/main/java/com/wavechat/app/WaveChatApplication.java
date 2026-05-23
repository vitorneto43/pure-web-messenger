package com.wavechat.app;

import android.app.Application;

import com.google.firebase.FirebaseApp;

public class WaveChatApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        initializeFirebase();
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.stopVibration(this);
    }

    public void initializeFirebase() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
            }
        } catch (Exception ignored) {}
    }
}