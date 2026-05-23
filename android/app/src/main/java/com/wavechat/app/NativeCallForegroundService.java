package com.wavechat.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class NativeCallForegroundService extends Service {
    public static final String ACTION_START = "com.wavechat.app.NATIVE_CALL_START";
    public static final String ACTION_STOP = "com.wavechat.app.NATIVE_CALL_STOP";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private String currentCallId;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_STOP : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopAlerts();
            stopSelf();
            return START_NOT_STICKY;
        }

        currentCallId = intent.getStringExtra("callId");
        String callerName = intent.getStringExtra("callerName");
        String kind = intent.getStringExtra("kind");
        String conversationId = intent.getStringExtra("conversationId");
        if (callerName == null || callerName.trim().isEmpty()) callerName = "Alguém";
        if (kind == null || kind.trim().isEmpty()) kind = "audio";
        if (conversationId == null) conversationId = "";

        CallAlertUtils.createSilentCallChannel(this);
        acquireWakeLock();
        Notification notification = buildCallNotification(currentCallId, callerName, kind, conversationId);
        startForeground(CallAlertUtils.notificationId(currentCallId), notification);
        CallAlertUtils.startCallVibration(this);

        Intent screenIntent = CallAlertUtils.incomingCallIntent(this, currentCallId, callerName, kind, conversationId);
        try {
            startActivity(screenIntent);
        } catch (Exception ignored) {}

        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            stopAlerts();
            stopSelf();
        }, 45_000);

        return START_NOT_STICKY;
    }

    private Notification buildCallNotification(String callId, String callerName, String kind, String conversationId) {
        Intent openIntent = CallAlertUtils.incomingCallIntent(this, callId, callerName, kind, conversationId);
        PendingIntent openPending = PendingIntent.getActivity(
            this,
            callId == null ? 9001 : callId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent acceptIntent = new Intent(this, CallActionReceiver.class);
        acceptIntent.setAction("com.wavechat.app.CALL_ACCEPT");
        acceptIntent.putExtra("callId", callId);
        acceptIntent.putExtra("action", "accept");
        PendingIntent acceptPending = PendingIntent.getBroadcast(
            this,
            (callId == null ? 9001 : callId.hashCode()) + 1,
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction("com.wavechat.app.CALL_DECLINE");
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("action", "decline");
        PendingIntent declinePending = PendingIntent.getBroadcast(
            this,
            (callId == null ? 9001 : callId.hashCode()) + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CallAlertUtils.ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("video".equals(kind) ? "Chamada de vídeo" : "Chamada de voz")
            .setContentText(callerName + " está te ligando…")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(false)
            .setSound(null)
            .setVibrate(new long[] { 0L, 750L, 450L, 750L, 1400L })
            .setTimeoutAfter(45_000)
            .setFullScreenIntent(openPending, true)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_call, "Atender", acceptPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Recusar", declinePending)
            .build();
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) return;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "WaveChat:IncomingCall"
            );
            wakeLock.acquire(50_000);
        } catch (Exception ignored) {}
    }

    private void stopAlerts() {
        handler.removeCallbacksAndMessages(null);
        CallAlertUtils.stopVibration(this);
        CallAlertUtils.stopNotificationEffects(this);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(CallAlertUtils.notificationId(currentCallId));
        try {
            stopForeground(true);
        } catch (Exception ignored) {}
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
        wakeLock = null;
    }

    @Override
    public void onDestroy() {
        stopAlerts();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}