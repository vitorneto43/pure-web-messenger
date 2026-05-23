package com.wavechat.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class CallStatusPoller {
    private static final String TAG = "WaveChatCallPoller";
    private static final String STATUS_URL = "https://webconnectchat.com/api/public/calls/status?callId=";
    private static final Map<String, Runnable> POLLERS = new ConcurrentHashMap<>();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private CallStatusPoller() {}

    public static void start(Context context, String callId) {
        if (callId == null || callId.trim().isEmpty()) return;
        stop(callId);
        Context appContext = context.getApplicationContext();
        long startedAt = System.currentTimeMillis();
        Runnable poller = new Runnable() {
            @Override
            public void run() {
                if (!POLLERS.containsKey(callId)) return;
                if (System.currentTimeMillis() - startedAt > 50_000) {
                    CallAlertUtils.stopAllCallAlerts(appContext, callId);
                    stop(callId);
                    return;
                }
                new Thread(() -> {
                    String status = readStatus(callId);
                    if (status != null && !"ringing".equals(status)) {
                        CallAlertUtils.stopAllCallAlerts(appContext, callId);
                        stop(callId);
                    } else if (POLLERS.containsKey(callId)) {
                        MAIN.postDelayed(this, 2_500);
                    }
                }).start();
            }
        };
        POLLERS.put(callId, poller);
        MAIN.postDelayed(poller, 1_200);
    }

    public static void stop(String callId) {
        if (callId == null) return;
        Runnable poller = POLLERS.remove(callId);
        if (poller != null) MAIN.removeCallbacks(poller);
    }

    private static String readStatus(String callId) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(STATUS_URL + URLEncoder.encode(callId, "UTF-8"));
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(3_000);
            connection.setReadTimeout(3_000);
            connection.setRequestMethod("GET");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) return null;
            InputStream stream = connection.getInputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            reader.close();
            return new JSONObject(body.toString()).optString("status", null);
        } catch (Exception e) {
            Log.w(TAG, "Call status poll failed", e);
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}