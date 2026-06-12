package com.wavechat.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import com.google.firebase.FirebaseApp;

public class WaveChatApplication extends Application {
    public static final String MESSAGES_CHANNEL_ID = "messages_v4";

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

            // Delete old broken/silent channels so Android can't route through them.
            try { nm.deleteNotificationChannel("messages"); } catch (Exception ignored) {}
            try { nm.deleteNotificationChannel("messages_v2"); } catch (Exception ignored) {}
            try { nm.deleteNotificationChannel("messages_v3"); } catch (Exception ignored) {}

            NotificationChannel channel = new NotificationChannel(
                MESSAGES_CHANNEL_ID,
                "Mensagens novas",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações de novas mensagens (som e vibração)");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{ 0, 250, 120, 250 });
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);

            // Explicitly bind the system default notification sound to the channel.
            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(defaultSound, audioAttrs);

            nm.createNotificationChannel(channel);
        } catch (Exception ignored) {}
    }
}
