package com.wavechat.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;

/**
 * Cross-OEM launcher icon badge updater. ShortcutBadger alone does not work
 * on MIUI / HyperOS (POCO, Xiaomi, Redmi). To cover those launchers we also:
 *
 *  1. Post a silent ongoing notification with setNumber(count) and use
 *     reflection to attach the MIUI-specific "miui.messageCount" extra.
 *     This is the trick WhatsApp / Telegram use to show the red dot
 *     with the count on MIUI/HyperOS launchers.
 *
 *  2. Fire the well-known OEM broadcasts (Samsung, Sony, LG, HTC, ASUS,
 *     Huawei) so launchers that listen to them update their counter too.
 *
 *  3. Fall back to ShortcutBadger which covers most remaining launchers.
 */
public final class BadgeUtils {
    private static final String BADGE_CHANNEL_ID = "wavechat_badge_v1";
    private static final int BADGE_NOTIFICATION_ID = 88_001;

    private BadgeUtils() {}

    public static void setBadgeCount(Context ctx, int count) {
        int n = Math.max(0, count);

        // 1. ShortcutBadger — Samsung, Sony, LG, Huawei (EMUI), ASUS, ADW, Apex, Nova
        try {
            me.leolin.shortcutbadger.ShortcutBadger.applyCount(ctx, n);
        } catch (Throwable ignored) {}

        // 2. Samsung TouchWiz / One UI explicit broadcast (some firmwares)
        try {
            Intent intent = new Intent("android.intent.action.BADGE_COUNT_UPDATE");
            intent.putExtra("badge_count", n);
            intent.putExtra("badge_count_package_name", ctx.getPackageName());
            intent.putExtra("badge_count_class_name",
                ctx.getPackageName() + ".MainActivity");
            ctx.sendBroadcast(intent);
        } catch (Throwable ignored) {}

        // 3. Sony broadcast
        try {
            Intent intent = new Intent("com.sonyericsson.home.action.UPDATE_BADGE");
            intent.putExtra("com.sonyericsson.home.intent.extra.badge.ACTIVITY_NAME",
                ctx.getPackageName() + ".MainActivity");
            intent.putExtra("com.sonyericsson.home.intent.extra.badge.SHOW_MESSAGE", n > 0);
            intent.putExtra("com.sonyericsson.home.intent.extra.badge.MESSAGE", String.valueOf(n));
            intent.putExtra("com.sonyericsson.home.intent.extra.badge.PACKAGE_NAME",
                ctx.getPackageName());
            ctx.sendBroadcast(intent);
        } catch (Throwable ignored) {}

        // 4. HTC broadcast
        try {
            Intent intent = new Intent("com.htc.launcher.action.UPDATE_SHORTCUT");
            intent.putExtra("packagename", ctx.getPackageName());
            intent.putExtra("count", n);
            ctx.sendBroadcast(intent);
        } catch (Throwable ignored) {}

        // 5. MIUI / HyperOS — must use a silent notification with reflection
        //    because Xiaomi blocks the standard broadcasts. The launcher only
        //    reads the count off a delivered Notification's extras.
        applyMiuiBadge(ctx, n);
    }

    private static void applyMiuiBadge(Context ctx, int count) {
        try {
            NotificationManager nm = (NotificationManager)
                ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel ch = nm.getNotificationChannel(BADGE_CHANNEL_ID);
                if (ch == null) {
                    ch = new NotificationChannel(
                        BADGE_CHANNEL_ID,
                        "Contador de mensagens",
                        NotificationManager.IMPORTANCE_MIN
                    );
                    ch.setShowBadge(true);
                    ch.enableLights(false);
                    ch.enableVibration(false);
                    ch.setSound(null, null);
                    ch.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
                    nm.createNotificationChannel(ch);
                }
            }

            if (count <= 0) {
                nm.cancel(BADGE_NOTIFICATION_ID);
                return;
            }

            Intent launch = ctx.getPackageManager()
                .getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent pi = null;
            if (launch != null) {
                pi = PendingIntent.getActivity(
                    ctx, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
            }

            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, BADGE_CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(count == 1
                    ? "1 nova mensagem"
                    : count + " novas mensagens")
                .setContentText("Toque para abrir o WaveChat")
                .setNumber(count)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setVisibility(NotificationCompat.VISIBILITY_SECRET)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setAutoCancel(true);
            if (pi != null) b.setContentIntent(pi);

            Notification notification = b.build();

            // MIUI / HyperOS extra
            try {
                Bundle extras = notification.extras != null ? notification.extras : new Bundle();
                extras.putInt("messageCount", count);
                Object extraNotification = notification.getClass()
                    .getDeclaredField("extraNotification").get(notification);
                if (extraNotification != null) {
                    extraNotification.getClass()
                        .getDeclaredMethod("setMessageCount", int.class)
                        .invoke(extraNotification, count);
                }
            } catch (Throwable ignored) {}

            nm.notify(BADGE_NOTIFICATION_ID, notification);
        } catch (Throwable ignored) {}
    }
}
