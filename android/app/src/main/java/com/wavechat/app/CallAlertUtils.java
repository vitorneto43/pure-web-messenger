package com.wavechat.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
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
    public static final String CHANNEL_ID = "wavechat_calls_native_v7";
    public static final String ALERT_CHANNEL_ID = "wavechat_calls_alert_v11";
    public static final String CHANNEL_NAME = "Chamadas WaveChat";
    private static Ringtone ringtonePlayer;
    private static MediaPlayer mediaPlayer;
    private static final java.util.List<MediaPlayer> leakedPlayers = new java.util.ArrayList<>();
    private static final java.util.List<Ringtone> leakedRingtones = new java.util.ArrayList<>();
    private static ToneGenerator fallbackTone;
    private static Handler fallbackHandler;
    private static Runnable fallbackRunnable;
    private static Handler ringtoneSafetyHandler;
    private static Runnable ringtoneSafetyRunnable;
    private static Handler vibrationHandler;
    private static Runnable vibrationRunnable;
    private static long vibrationStartedAt;
    private static final long MAX_ALERT_DURATION_MS = 45_000L;
    // Native vibration was the source of the infinite vibration loop on older Android devices.
    // Keep it disabled by default; the ringtone + full-screen call UI are enough for incoming calls.
    private static final boolean ENABLE_NATIVE_CALL_VIBRATION = false;
    private static AudioFocusRequest inCallFocusRequest;
    private static Vibrator currentVibrator;  // FIX: Track current vibrator
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
        manager.deleteNotificationChannel("wavechat_calls_alert_v9");
        manager.deleteNotificationChannel("wavechat_calls_alert_v10");
        manager.deleteNotificationChannel("wavechat_calls_native_v5");
        manager.deleteNotificationChannel("wavechat_calls_native_v6");
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
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setVibrationPattern(null);
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
        alertChannel.setSound(null, null);
        alertChannel.enableVibration(false);
        alertChannel.setVibrationPattern(null);
        alertChannel.enableLights(true);
        alertChannel.setShowBadge(false);
        alertChannel.setBypassDnd(false);
        alertChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(alertChannel);
    }

    public static void stopAllCallAlerts(Context context, String callId) {
        CallStatusPoller.stop(callId);
        try {
            Intent stopIntent = new Intent(context, NativeCallForegroundService.class);
            stopIntent.setAction(NativeCallForegroundService.ACTION_STOP);
            stopIntent.putExtra("callId", callId);
            context.stopService(stopIntent);
        } catch (Exception ignored) {}
        cancelCallNotification(context, callId);
        WaveChatTelecomManager.endIncomingCall(context, callId);
        IncomingCallActivity.finishCallScreen(callId);
        stopCallRingtone(context);
        stopNotificationEffects(context);
        stopVibration(context);  // FIX: Ensure vibration is stopped
        try {
            Intent endedIntent = new Intent("com.wavechat.app.CALL_ALERT_ENDED");
            endedIntent.putExtra("callId", callId);
            context.sendBroadcast(endedIntent);
        } catch (Exception ignored) {}
    }

    public static void watchCallStatus(Context context, String callId) {
        CallStatusPoller.start(context, callId);
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
            stopCallRingtone(context);
            stopVibration(context);  // FIX: Stop vibration when call is answered
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
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.setSpeakerphoneOn(false);
            // VOLUME BOOST: raise call + media streams to MAX so remote audio
            // is audible even on devices with conservative defaults (POCO/MIUI,
            // Samsung One UI). FLAG_PLAY_SOUND=0 keeps it silent.
            try {
                int maxVoice = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVoice, 0);
                int maxMusic = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, 0);
            } catch (Exception ignored) {}
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                java.util.List<android.media.AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                android.media.AudioDeviceInfo target = null;
                for (android.media.AudioDeviceInfo device : devices) {
                    int type = device.getType();
                    if (type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO || type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                        target = device;
                        break;
                    }
                    if (target == null && type == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                        target = device;
                    }
                }
                if (target != null) audioManager.setCommunicationDevice(target);
            }
        } catch (Exception ignored) {}
    }

    public static void setSpeakerphone(Context context, boolean on) {
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                java.util.List<android.media.AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                android.media.AudioDeviceInfo target = null;
                int wanted = on
                    ? android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    : android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                for (android.media.AudioDeviceInfo device : devices) {
                    if (device.getType() == wanted) { target = device; break; }
                }
                if (target != null) audioManager.setCommunicationDevice(target);
            }
            audioManager.setSpeakerphoneOn(on);
            try {
                int maxVoice = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL);
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVoice, 0);
                int maxMusic = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, 0);
            } catch (Exception ignored) {}
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
        // CRITICAL: Single-instance guard. Many code paths (FCM service, foreground
        // service, IncomingCallActivity, ConnectionService) all call this method.
        // If we ever start a second player we leak the first one and it rings
        // forever on MIUI/HyperOS because Ringtone.stop() is unreliable there.
        if (mediaPlayer != null) {
            scheduleRingtoneSafetyStop(context.getApplicationContext());
            return;
        }
        // Make sure any stale player from a previous call is fully torn down.
        stopCallRingtone(context);

        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.requestAudioFocus(
                    audioFocusListener,
                    AudioManager.STREAM_RING,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                );
                // VOLUME BOOST: force ringer + notification streams to MAX so the
                // incoming-call ringtone is clearly audible even on devices where
                // the user lowered the ringer volume (POCO/MIUI, Samsung One UI).
                try {
                    int maxRing = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);
                    audioManager.setStreamVolume(AudioManager.STREAM_RING, maxRing, 0);
                    int maxNotif = audioManager.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
                    audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, maxNotif, 0);
                    int maxAlarm = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarm, 0);
                } catch (Exception ignored) {}
                // Make sure the device is not in silent/vibrate mode so the
                // ringtone actually plays out loud.
                try {
                    if (audioManager.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
                        audioManager.setRingerMode(AudioManager.RINGER_MODE_NORMAL);
                    }
                } catch (Exception ignored) {}
            }

            Uri uri = callRingtoneUri(context);
            MediaPlayer mp = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            } else {
                mp.setAudioStreamType(AudioManager.STREAM_RING);
            }
            mp.setDataSource(context.getApplicationContext(), uri);
            mp.setLooping(true);
            try { mp.setVolume(1.0f, 1.0f); } catch (Exception ignored) {}
            mp.prepare();
            mp.start();
            mediaPlayer = mp;
            leakedPlayers.add(mp);
            scheduleRingtoneSafetyStop(context.getApplicationContext());
        } catch (Exception ignored) {
            // MediaPlayer failed (corrupted ringtone, no permission, etc.) — fall
            // back to a generated tone so the user still hears something.
            startFallbackTone();
            scheduleRingtoneSafetyStop(context.getApplicationContext());
        }
    }

    private static synchronized void scheduleRingtoneSafetyStop(Context context) {
        if (ringtoneSafetyHandler == null) ringtoneSafetyHandler = new Handler(Looper.getMainLooper());
        if (ringtoneSafetyRunnable != null) ringtoneSafetyHandler.removeCallbacks(ringtoneSafetyRunnable);
        ringtoneSafetyRunnable = () -> stopCallRingtone(context);
        ringtoneSafetyHandler.postDelayed(ringtoneSafetyRunnable, MAX_ALERT_DURATION_MS);
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

    private static synchronized void stopRingtoneSafetyStop() {
        try {
            if (ringtoneSafetyHandler != null && ringtoneSafetyRunnable != null) {
                ringtoneSafetyHandler.removeCallbacks(ringtoneSafetyRunnable);
            }
        } catch (Exception ignored) {
        } finally {
            ringtoneSafetyRunnable = null;
            ringtoneSafetyHandler = null;
        }
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
            stopRingtoneSafetyStop();
            stopFallbackTone();
            // Tear down EVERY MediaPlayer we ever started for this call session.
            // On some ROMs the FCM + foreground-service + activity start paths can
            // race and create more than one player; the leakedPlayers list lets us
            // kill all of them, not just the most recent one tracked in mediaPlayer.
            for (MediaPlayer mp : leakedPlayers) {
                try { if (mp.isPlaying()) mp.stop(); } catch (Exception ignored) {}
                try { mp.reset(); } catch (Exception ignored) {}
                try { mp.release(); } catch (Exception ignored) {}
            }
            leakedPlayers.clear();
            if (mediaPlayer != null) {
                try { mediaPlayer.stop(); } catch (Exception ignored) {}
                try { mediaPlayer.reset(); } catch (Exception ignored) {}
                try { mediaPlayer.release(); } catch (Exception ignored) {}
            }
            // Also clean up any legacy Ringtone instances from older code paths.
            for (Ringtone r : leakedRingtones) {
                try { r.stop(); } catch (Exception ignored) {}
            }
            leakedRingtones.clear();
            if (ringtonePlayer != null) {
                try { ringtonePlayer.stop(); } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {
        } finally {
            mediaPlayer = null;
            ringtonePlayer = null;
            try {
                AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) audioManager.abandonAudioFocus(audioFocusListener);
            } catch (Exception ignored) {}
        }
    }

    public static synchronized void startCallVibration(Context context) {
        // IMPORTANT FIX:
        // Older Android devices can keep vibrating when multiple call alerts are started
        // by FCM + foreground service + incoming-call activity at the same time.
        // We always cancel any previous vibration and, by default, do NOT start a new
        // native vibration loop. This prevents the "vibrando sem parar" bug.
        stopVibration(context);
        if (!ENABLE_NATIVE_CALL_VIBRATION) return;

        vibrationStartedAt = System.currentTimeMillis();
        vibrationHandler = new Handler(Looper.getMainLooper());
        Context appContext = context.getApplicationContext();
        vibrationRunnable = new Runnable() {
            @Override
            public void run() {
                if (System.currentTimeMillis() - vibrationStartedAt >= MAX_ALERT_DURATION_MS) {
                    stopVibration(appContext);
                    return;
                }
                vibrateOnce(appContext);
                if (vibrationHandler != null) vibrationHandler.postDelayed(this, 3_200L);
            }
        };
        vibrationHandler.post(vibrationRunnable);
    }

    private static void vibrateOnce(Context context) {
        try {
            long[] pattern = new long[] { 0L, 650L, 350L, 650L };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    currentVibrator = vm.getDefaultVibrator();
                    vibrate(currentVibrator, pattern);
                }
            } else {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                currentVibrator = vibrator;
                vibrate(vibrator, pattern);
            }
        } catch (Exception ignored) {}
    }

    private static void vibrate(Vibrator vibrator, long[] pattern) {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
    }

    public static synchronized void stopVibration(Context context) {
        try {
            if (vibrationHandler != null && vibrationRunnable != null) {
                vibrationHandler.removeCallbacks(vibrationRunnable);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vm.cancel();  // FIX: Cancel all vibrations
                }
            } else {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null) {
                    vibrator.cancel();  // FIX: Cancel vibration
                }
            }
            currentVibrator = null;
            vibrationStartedAt = 0L;
            vibrationRunnable = null;
            vibrationHandler = null;
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
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("callId", callId);
        intent.putExtra("callerName", callerName);
        intent.putExtra("kind", kind);
        intent.putExtra("conversationId", conversationId);
        return intent;
    }
}
