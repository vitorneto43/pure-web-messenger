package com.wavechat.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class WaveChatMessagingService extends FirebaseMessagingService {
    private static final String TAG = "WaveChatFCM";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        ensureFirebaseReady();

        if (remoteMessage.getData() != null && "call_cancel".equals(remoteMessage.getData().get("type"))) {
            String callId = remoteMessage.getData().getOrDefault("callId", "");
            CallAlertUtils.stopAllCallAlerts(this, callId);
        } else if (remoteMessage.getData() != null && "call_end".equals(remoteMessage.getData().get("type"))) {
            String callId = remoteMessage.getData().getOrDefault("callId", "");
            CallAlertUtils.stopAllCallAlerts(this, callId);
        } else if (remoteMessage.getData() != null && "call".equals(remoteMessage.getData().get("type"))) {
            showIncomingCallNotification(remoteMessage.getData());
        } else if (remoteMessage.getData() != null && "message".equals(remoteMessage.getData().get("type"))) {
            showMessageNotification(remoteMessage.getData());
            // Also forward to the JS bridge so an open app updates its in-app
            // state (unread badge, conversation list) without waiting for realtime.
            try { PushNotificationsPlugin.sendRemoteMessage(remoteMessage); } catch (Exception ignored) {}
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

    /**
     * Post a system notification for a new chat message — WhatsApp-style.
     * Works whether the app is foreground, background or killed because the
     * MessagingService runs even when no Activity / JS bridge is alive.
     */
    private void showMessageNotification(Map<String, String> data) {
        String title = data.getOrDefault("title", "Nova mensagem");
        String body = data.getOrDefault("body", "");
        String conversationId = data.getOrDefault("conversationId", "");
        String senderName = data.getOrDefault("senderName", title);
        int badge = 0;
        try { badge = Integer.parseInt(data.getOrDefault("badge", "0")); } catch (Exception ignored) {}

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Tap → opens MainActivity. MainActivity already forwards the
        // conversationId extra to JS via the 'wavechat-android-intent' window
        // event, which our message-intent hook turns into a /chat/:id navigate.
        Intent open = new Intent(this, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!conversationId.isEmpty()) open.putExtra("conversationId", conversationId);
        open.putExtra("source", "message_push");
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            ("msg-" + conversationId).hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String groupKey = "wavechat.msg." + (conversationId.isEmpty() ? "all" : conversationId);

        // MessagingStyle gives Android the rich chat layout (avatar slot,
        // inline reply on Wear, smart bundling). Same UX as WhatsApp.
        Person sender = new Person.Builder().setName(senderName).setImportant(true).build();
        NotificationCompat.MessagingStyle style =
            new NotificationCompat.MessagingStyle(new Person.Builder().setName("Você").build())
                .setConversationTitle(title)
                .addMessage(new NotificationCompat.MessagingStyle.Message(
                    body, System.currentTimeMillis(), sender));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, WaveChatApplication.MESSAGES_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(style)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(contentIntent)
            .setGroup(groupKey)
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true);
        if (badge > 0) builder.setNumber(badge);

        int notifId = conversationId.isEmpty()
            ? (int) (System.currentTimeMillis() & 0x7fffffff)
            : ("msg-" + conversationId).hashCode();

        try {
            NotificationManagerCompat.from(this).notify(notifId, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted — nothing to do.
        }

        // Launcher icon badge across all OEMs (Samsung/Xiaomi/Oppo/Vivo/Huawei/Sony/HTC/Nova/Pixel).
        if (badge > 0) {
            BadgeUtils.setBadgeCount(this, badge);
        }
    }



    private void showIncomingCallNotification(java.util.Map<String, String> data) {
        String callerName = data.getOrDefault("callerName", "Alguém");
        String callId = data.getOrDefault("callId", "");
        String kind = data.getOrDefault("kind", "audio");
        String conversationId = data.getOrDefault("conversationId", "");

        if (WaveChatTelecomManager.showIncomingCall(this, callId, callerName, kind, conversationId)) {
            return;
        }

        Intent serviceIntent = new Intent(this, NativeCallForegroundService.class);
        serviceIntent.setAction(NativeCallForegroundService.ACTION_START);
        serviceIntent.putExtra("callId", callId);
        serviceIntent.putExtra("callerName", callerName);
        serviceIntent.putExtra("kind", kind);
        serviceIntent.putExtra("conversationId", conversationId);
        boolean serviceStarted = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            serviceStarted = true;
        } catch (Exception e) {
            Log.w(TAG, "Foreground call service failed, falling back to direct notification", e);
        }

        if (serviceStarted) return;

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (notificationManager == null) return;
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.startCallRingtone(this);
        CallAlertUtils.startCallVibration(this);
        CallAlertUtils.watchCallStatus(this, callId);

        // WhatsApp-style: open a dedicated native incoming-call screen even if the app is closed.
        Intent intent = CallAlertUtils.incomingCallIntent(this, callId, callerName, kind, conversationId);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, callId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the high-priority call notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CallAlertUtils.ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(kind.equals("video") ? "Chamada de vídeo" : "Chamada de voz")
            .setContentText(callerName + " está te ligando…")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(false)
            .setOnlyAlertOnce(false)
            .setSilent(true)
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(
                new Person.Builder().setName(callerName).setImportant(true).build(),
                declinePending,
                acceptPending
            ));
        }

        notificationManager.notify(CallAlertUtils.notificationId(callId), builder.build());
        try {
            startActivity(intent);
        } catch (Exception ignored) {}
    }
}
