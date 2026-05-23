package com.wavechat.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.media.Ringtone;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;

public final class CallAlertUtils {
    public static final String CHANNEL_ID = "wavechat_calls_native_v5";
    public static final String ALERT_CHANNEL_ID = "wavechat_calls_alert_v9";
    public static final String CHANNEL_NAME = "Chamadas WaveChat";
    private static Ringtone ringtonePlayer;
    private static ToneGenerator fallbackTone;
    private static Handler fallbackHandler;
    private static Runnable fallbackRunnable;
    private static AudioFocusRequest inCallFocusRequest;
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
        manager.deleteNotificationChannel("wavechat_calls_native_v4");
        manager.deleteNotificationChannel("wavechat_calls_alert_v5");
        manager.deleteNotificationChannel("wavechat_calls_alert_v6");
        manager.deleteNotificationChannel("wavechat_calls_alert_v7");
        manager.deleteNotificationChannel("wavechat_calls_alert_v8");
        manager.deleteNotificationChannel(CHANNEL_ID);

        AudioAttributes ringAttrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        Uri ringUri = callRingtoneUri(context);

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Tela de chamada recebida do WaveChat");
        channel.setSound(ringUri, ringAttrs);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0L, 900L, 350L, 900L, 1200L });
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
        alertChannel.setSound(ringUri, ringAttrs);
        alertChannel.enableVibration(true);
        alertChannel.setVibrationPattern(new long[] { 0L, 900L, 350L, 900L, 1200L });
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
        WaveChatTelecomManager.endIncomingCall(context, callId);
        stopCallRingtone(context);
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
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && inCallFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(inCallFocusRequest);
                    inCallFocusRequest = null;
                }
                audioManager.abandonAudioFocus(audioFocusListener);
            }
        } catch (Exception ignored) {}
    }

    public static void configureInCallAudio(Context context) {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && inCallFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(inCallFocusRequest);
                inCallFocusRequest = null;
            }
            audioManager.abandonAudioFocus(audioFocusListener);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                inCallFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build())
                    .setOnAudioFocusChangeListener(audioFocusListener)
                    .build();
                audioManager.requestAudioFocus(inCallFocusRequest);
            } else {
                audioManager.requestAudioFocus(
                    audioFocusListener,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                );
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                audioManager.setCommunicationDevice(null);
            }
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.setSpeakerphoneOn(false);
        } catch (Exception ignored) {}
    }

    public static void resetInCallAudio(Context context) {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && inCallFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(inCallFocusRequest);
                inCallFocusRequest = null;
            }
            audioManager.abandonAudioFocus(audioFocusListener);
            audioManager.setSpeakerphoneOn(false);
            audioManager.setMode(AudioManager.MODE_NORMAL);
        } catch (Exception ignored) {}
    }

    public static Uri callRingtoneUri(Context context) {
        Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(
            context.getApplicationContext(),
            RingtoneManager.TYPE_RINGTONE
        );
        if (ringtoneUri == null) {
            ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(
                context.getApplicationContext(),
                RingtoneManager.TYPE_NOTIFICATION
            );
        }
        return ringtoneUri == null ? Settings.System.DEFAULT_RINGTONE_URI : ringtoneUri;
    }

    public static synchronized void startCallRingtone(Context context) {
        try {
            if (ringtonePlayer != null && ringtonePlayer.isPlaying()) return;
            stopCallRingtone(context);

            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.requestAudioFocus(
                    audioFocusListener,
                    AudioManager.STREAM_RING,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                );
            }

            Ringtone player = RingtoneManager.getRingtone(context.getApplicationContext(), callRingtoneUri(context));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) player.setLooping(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            } else {
                player.setStreamType(AudioManager.STREAM_RING);
            }
            player.play();
            ringtonePlayer = player;
        } catch (Exception ignored) {
            startFallbackTone();
        }
    }

    private static synchronized void startFallbackTone() {
        try {
            stopFallbackTone();
            fallbackTone = new ToneGenerator(AudioManager.STREAM_RING, 100);
            fallbackHandler = new Handler(Looper.getMainLooper());
            fallbackRunnable = new Runnable() {
                @Override
                public void run() {
                    try {
                        if (fallbackTone != null) fallbackTone.startTone(ToneGenerator.TONE_SUP_RINGTONE, 1200);
                        if (fallbackHandler != null) fallbackHandler.postDelayed(this, 2500);
                    } catch (Exception ignored) {}
                }
            };
            fallbackHandler.post(fallbackRunnable);
        } catch (Exception ignored) {}
    }

    private static synchronized void stopFallbackTone() {
        try {
            if (fallbackHandler != null && fallbackRunnable != null) fallbackHandler.removeCallbacks(fallbackRunnable);
            if (fallbackTone != null) fallbackTone.release();
        } catch (Exception ignored) {
        } finally {
            fallbackTone = null;
            fallbackHandler = null;
            fallbackRunnable = null;
        }
    }

    public static synchronized void stopCallRingtone(Context context) {
        try {
            stopFallbackTone();
            if (ringtonePlayer != null) {
                if (ringtonePlayer.isPlaying()) ringtonePlayer.stop();
            }
        } catch (Exception ignored) {
        } finally {
            ringtonePlayer = null;
            try {
                AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) audioManager.abandonAudioFocus(audioFocusListener);
            } catch (Exception ignored) {}
        }
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