package com.wavechat.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;

public final class CallAlertUtils {
    public static final String CHANNEL_ID = "wavechat_calls_native_v4";
    public static final String ALERT_CHANNEL_ID = "wavechat_calls_alert_v6";
    public static final String CHANNEL_NAME = "Chamadas WaveChat";
    private static MediaPlayer ringtonePlayer;
    private static final AudioManager.OnAudioFocusChangeListener audioFocusListener = focusChange -> {};

    private CallAlertUtils() {}

    public static int notificationId(String callId) {
        return callId == null ? 9001 : callId.hashCode();
    }

    public static void createSilentCallChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        manager.deleteNotificationChannel("wavechat_incoming_calls");
        manager.deleteNotificationChannel("wavechat_incoming_calls_v2");
        manager.deleteNotificationChannel("wavechat_call_channel");
        manager.deleteNotificationChannel("wavechat_calls_native_v3");
        manager.deleteNotificationChannel("wavechat_calls_alert_v5");
        manager.deleteNotificationChannel(CHANNEL_ID);

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Tela de chamada recebida do WaveChat");
        channel.setSound(null, new AudioAttributes.Builder().build());
        channel.enableVibration(false);
        channel.setVibrationPattern(new long[] { 0L });
        channel.enableLights(false);
        channel.setShowBadge(false);
        channel.setBypassDnd(false);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);

        NotificationChannel alertChannel = new NotificationChannel(
            ALERT_CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("Alerta de chamada recebida do WaveChat");
        alertChannel.setSound(null, new AudioAttributes.Builder().build());
        alertChannel.enableVibration(true);
        alertChannel.setVibrationPattern(new long[] { 0L, 750L, 450L, 750L, 1400L });
        alertChannel.enableLights(true);
        alertChannel.setShowBadge(false);
        alertChannel.setBypassDnd(false);
        alertChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(alertChannel);
    }

    public static void stopAllCallAlerts(Context context, String callId) {
        try {
            Intent stopIntent = new Intent(context, NativeCallForegroundService.class);
            stopIntent.setAction(NativeCallForegroundService.ACTION_STOP);
            stopIntent.putExtra("callId", callId);
            context.stopService(stopIntent);
        } catch (Exception ignored) {}
        cancelCallNotification(context, callId);
        stopNotificationEffects(context);
        stopVibration(context);
    }

    public static void cancelCallNotification(Context context, String callId) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (callId != null) manager.cancel(notificationId(callId));
        manager.cancelAll();
    }

    public static void stopNotificationEffects(Context context) {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.abandonAudioFocus(null);
                audioManager.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception ignored) {}
    }

    public static void startCallVibration(Context context) {
        try {
            long[] pattern = new long[] { 0L, 750L, 450L, 750L, 1400L };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vibrate(vm.getDefaultVibrator(), pattern);
                }
            } else {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                vibrate(vibrator, pattern);
            }
        } catch (Exception ignored) {}
    }

    private static void vibrate(Vibrator vibrator, long[] pattern) {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        } else {
            vibrator.vibrate(pattern, 0);
        }
    }

    public static void stopVibration(Context context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vm.cancel();
            } else {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null) vibrator.cancel();
            }
        } catch (Exception ignored) {}
    }

    public static Intent mainActivityIntent(Context context, String callId, String action) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("callId", callId);
        intent.putExtra("action", action);
        return intent;
    }

    public static Intent incomingCallIntent(Context context, String callId, String callerName, String kind, String conversationId) {
        Intent intent = new Intent(context, IncomingCallActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("callId", callId);
        intent.putExtra("callerName", callerName);
        intent.putExtra("kind", kind);
        intent.putExtra("conversationId", conversationId);
        return intent;
    }
}