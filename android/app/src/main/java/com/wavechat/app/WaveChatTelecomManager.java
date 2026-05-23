package com.wavechat.app;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.util.Log;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class WaveChatTelecomManager {
    private static final String TAG = "WaveChatTelecom";
    private static final String ACCOUNT_ID = "wavechat_calls";
    private static final Map<String, WaveChatConnectionService.WaveChatConnection> CONNECTIONS = new ConcurrentHashMap<>();

    private WaveChatTelecomManager() {}

    public static boolean showIncomingCall(Context context, String callId, String callerName, String kind, String conversationId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || callId == null || callId.trim().isEmpty()) return false;

        try {
            TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            if (telecom == null) return false;

            PhoneAccountHandle handle = phoneAccountHandle(context);
            PhoneAccount account = PhoneAccount.builder(handle, "WaveChat")
                .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
                .setShortDescription("WaveChat")
                .build();
            telecom.registerPhoneAccount(account);

            Bundle extras = new Bundle();
            extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle);
            extras.putString("callId", callId);
            extras.putString("callerName", callerName == null || callerName.trim().isEmpty() ? "Alguém" : callerName);
            extras.putString("kind", kind == null || kind.trim().isEmpty() ? "audio" : kind);
            extras.putString("conversationId", conversationId == null ? "" : conversationId);
            extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, Uri.fromParts("wavechat", callerName == null ? "WaveChat" : callerName, null));

            telecom.addNewIncomingCall(handle, extras);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Telecom incoming call failed", e);
            return false;
        }
    }

    public static PhoneAccountHandle phoneAccountHandle(Context context) {
        return new PhoneAccountHandle(new ComponentName(context, WaveChatConnectionService.class), ACCOUNT_ID);
    }

    public static void registerConnection(String callId, WaveChatConnectionService.WaveChatConnection connection) {
        if (callId != null) CONNECTIONS.put(callId, connection);
    }

    public static void unregisterConnection(String callId) {
        if (callId != null) CONNECTIONS.remove(callId);
    }

    public static void endIncomingCall(Context context, String callId) {
        if (callId == null) return;
        WaveChatConnectionService.WaveChatConnection connection = CONNECTIONS.remove(callId);
        if (connection != null) {
            try {
                connection.setDisconnected(new android.telecom.DisconnectCause(android.telecom.DisconnectCause.LOCAL));
                connection.destroy();
            } catch (Exception ignored) {}
        }
    }
}