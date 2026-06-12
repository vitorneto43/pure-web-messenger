package com.wavechat.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import com.google.firebase.FirebaseApp;

public class WaveChatApplication extends Application {
    // v2 of the messages channel — we needed to recreate it on already-installed
    // APKs to attach default sound, vibration pattern, public lockscreen
    // visibility and badge. Android does NOT update settings of an existing
    // channel, so bumping the id is the only reliable way.
    public static final String MESSAGES_CHANNEL_ID = "messages_v2";

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

            // Drop the legacy silent channel so users don't see two entries
            // in system settings after upgrading.
            try { nm.deleteNotificationChannel("messages"); } catch (Exception ignored) {}

            NotificationChannel channel = new NotificationChannel(
                MESSAGES_CHANNEL_ID,
                "Mensagens",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações de novas mensagens");
            channel.enableLights(true);
            channel.setLightColor(0xFF1E88E5);
            channel.enableVibration(true);
            // WhatsApp-style pattern: short pulse + longer pulse so it's
            // clearly perceived even with the phone in a pocket.
            channel.setVibrationPattern(new long[]{0, 250, 200, 250, 200, 400});
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            // Default notification sound, tagged as USAGE_NOTIFICATION_COMMUNICATION_INSTANT
            // so OEM launchers (MIUI/HyperOS, OneUI) treat it as a chat ping
            // and respect Do Not Disturb chat exceptions.
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            channel.setSound(sound, audioAttrs);

            nm.createNotificationChannel(channel);
        } catch (Exception ignored) {}
    }
}
