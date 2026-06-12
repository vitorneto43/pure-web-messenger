package com.wavechat.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

import com.google.firebase.FirebaseApp;

public class WaveChatApplication extends Application {
    public static final String MESSAGES_CHANNEL_ID = "messages";

    @Override
    public void onCreate() {
        super.onCreate();
        initializeFirebase();
        createMessagesChannel();
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

    private void createMessagesChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                MESSAGES_CHANNEL_ID,
                "Mensagens",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações de novas mensagens");
            channel.enableLights(true);
            channel.enableVibration(true);
            nm.createNotificationChannel(channel);
        } catch (Exception ignored) {}
    }
}
