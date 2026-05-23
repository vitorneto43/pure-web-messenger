package com.wavechat.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

public class WaveChatMessagingService extends FirebaseMessagingService {
    private static final String TAG = "WaveChatFCM";
    private static final String CHANNEL_ID = "wavechat_incoming_calls_v2";
    private static final String CHANNEL_NAME = "Chamadas WaveChat";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Check if this is a call notification
        if (remoteMessage.getData() != null && "call".equals(remoteMessage.getData().get("type"))) {
            showIncomingCallNotification(remoteMessage.getData());
        } else {
            // Delegate to Capacitor PushNotifications plugin
            // The plugin will handle normal notifications
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed token: " + token);
        // Token will be picked up by Capacitor PushNotifications plugin
    }

    private void showIncomingCallNotification(java.util.Map<String, String> data) {
        String callerName = data.getOrDefault("callerName", "Alguém");
        String callId = data.getOrDefault("callId", "");
        String kind = data.getOrDefault("kind", "audio");

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        // Create notification channel for calls (required for Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações de chamadas recebidas");
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setBypassDnd(true);
            notificationManager.createNotificationChannel(channel);
        }

        // Intent to open the app when user taps the notification
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("callId", callId);
        intent.putExtra("action", "accept");
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, callId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the high-priority call notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(kind.equals("video") ? "Chamada de vídeo" : "Chamada de voz")
            .setContentText(callerName + " está te ligando…")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(false)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(45_000)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent);

        // Add accept/decline actions
        Intent acceptIntent = new Intent(this, CallActionReceiver.class);
        acceptIntent.setAction("com.wavechat.app.CALL_ACCEPT");
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("action", "accept");
        PendingIntent acceptPending = PendingIntent.getBroadcast(
            this, callId.hashCode() + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        builder.addAction(android.R.drawable.ic_menu_call, "Atender", acceptPending);

        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction("com.wavechat.app.CALL_DECLINE");
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("action", "decline");
        PendingIntent declinePending = PendingIntent.getBroadcast(
            this, callId.hashCode() + 2, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Recusar", declinePending);

        notificationManager.notify(callId.hashCode(), builder.build());
    }
}
