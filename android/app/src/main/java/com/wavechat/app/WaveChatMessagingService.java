package com.wavechat.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class WaveChatMessagingService extends FirebaseMessagingService {
    private static final String TAG = "WaveChatFCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        ensureFirebaseReady();
        CallAlertUtils.stopVibration(this);

        if (remoteMessage.getData() != null && "call".equals(remoteMessage.getData().get("type"))) {
            showIncomingCallNotification(remoteMessage.getData());
        } else {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        ensureFirebaseReady();
        Log.d(TAG, "Refreshed token: " + token);
        PushNotificationsPlugin.onNewToken(token);
    }

    private void ensureFirebaseReady() {
        try {
            if (com.google.firebase.FirebaseApp.getApps(this).isEmpty()) {
                com.google.firebase.FirebaseApp.initializeApp(this);
            }
        } catch (Exception ignored) {}
    }

    private void showIncomingCallNotification(java.util.Map<String, String> data) {
        String callerName = data.getOrDefault("callerName", "Alguém");
        String callId = data.getOrDefault("callId", "");
        String kind = data.getOrDefault("kind", "audio");
        String conversationId = data.getOrDefault("conversationId", "");

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (notificationManager == null) return;
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.stopVibration(this);

        // WhatsApp-style: open a dedicated native incoming-call screen even if the app is closed.
        Intent intent = CallAlertUtils.incomingCallIntent(this, callId, callerName, kind, conversationId);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, callId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the high-priority call notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CallAlertUtils.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(kind.equals("video") ? "Chamada de vídeo" : "Chamada de voz")
            .setContentText(callerName + " está te ligando…")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(false)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVibrate(new long[] { 0L })
            .setSound(null)
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

        notificationManager.notify(CallAlertUtils.notificationId(callId), builder.build());
        try {
            startActivity(intent);
        } catch (Exception ignored) {}
    }
}
