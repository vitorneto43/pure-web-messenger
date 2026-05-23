package com.wavechat.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccountHandle;

public class WaveChatConnectionService extends ConnectionService {
    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request.getExtras();
        String callId = extras == null ? "" : extras.getString("callId", "");
        String callerName = extras == null ? "Alguém" : extras.getString("callerName", "Alguém");
        String kind = extras == null ? "audio" : extras.getString("kind", "audio");
        String conversationId = extras == null ? "" : extras.getString("conversationId", "");

        WaveChatConnection connection = new WaveChatConnection(this, callId, callerName, kind, conversationId);
        connection.setAddress(request.getAddress(), android.telecom.TelecomManager.PRESENTATION_ALLOWED);
        connection.setCallerDisplayName(callerName, android.telecom.TelecomManager.PRESENTATION_ALLOWED);
        connection.setConnectionCapabilities(Connection.CAPABILITY_MUTE);
        connection.setAudioModeIsVoip(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) connection.setConnectionProperties(Connection.PROPERTY_SELF_MANAGED);
        connection.setRinging();
        WaveChatTelecomManager.registerConnection(callId, connection);
        CallAlertUtils.createSilentCallChannel(this);
        CallAlertUtils.startCallRingtone(this);
        CallAlertUtils.startCallVibration(this);
        CallAlertUtils.watchCallStatus(this, callId);
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            try {
                startActivity(CallAlertUtils.incomingCallIntent(this, callId, callerName, kind, conversationId));
            } catch (Exception ignored) {}
        }, 500);
        return connection;
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request == null ? null : request.getExtras();
        String callId = extras == null ? "" : extras.getString("callId", "");
        String callerName = extras == null ? "Alguém" : extras.getString("callerName", "Alguém");
        String kind = extras == null ? "audio" : extras.getString("kind", "audio");
        String conversationId = extras == null ? "" : extras.getString("conversationId", "");

        Intent serviceIntent = new Intent(this, NativeCallForegroundService.class);
        serviceIntent.setAction(NativeCallForegroundService.ACTION_START);
        serviceIntent.putExtra("callId", callId);
        serviceIntent.putExtra("callerName", callerName);
        serviceIntent.putExtra("kind", kind);
        serviceIntent.putExtra("conversationId", conversationId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent);
            else startService(serviceIntent);
        } catch (Exception ignored) {}
    }

    public static class WaveChatConnection extends Connection {
        private final Context context;
        private final String callId;
        private final String callerName;
        private final String kind;
        private final String conversationId;

        WaveChatConnection(Context context, String callId, String callerName, String kind, String conversationId) {
            this.context = context.getApplicationContext();
            this.callId = callId;
            this.callerName = callerName;
            this.kind = kind;
            this.conversationId = conversationId;
            setInitializing();
        }

        @Override
        public void onAnswer() {
            answer();
        }

        @Override
        public void onAnswer(int videoState) {
            answer();
        }

        @Override
        public void onShowIncomingCallUi() {
            Intent intent = CallAlertUtils.incomingCallIntent(context, callId, callerName, kind, conversationId);
            context.startActivity(intent);
        }

        @Override
        public void onReject() {
            reject();
        }

        @Override
        public void onDisconnect() {
            CallAlertUtils.stopCallRingtone(context);
            CallAlertUtils.stopVibration(context);
            CallStatusPoller.stop(callId);
            setDisconnected(new DisconnectCause(DisconnectCause.LOCAL));
            WaveChatTelecomManager.unregisterConnection(callId);
            destroy();
        }

        @Override
        public void onAbort() {
            reject();
        }

        private void answer() {
            CallAlertUtils.stopCallRingtone(context);
            CallAlertUtils.stopVibration(context);
            CallStatusPoller.stop(callId);
            CallAlertUtils.configureInCallAudio(context);
            setActive();
            Intent intent = CallAlertUtils.mainActivityIntent(context, callId, "accept");
            intent.putExtra("callerName", callerName);
            intent.putExtra("kind", kind);
            intent.putExtra("conversationId", conversationId);
            context.startActivity(intent);
        }

        private void reject() {
            CallAlertUtils.stopCallRingtone(context);
            CallAlertUtils.stopVibration(context);
            CallStatusPoller.stop(callId);
            setDisconnected(new DisconnectCause(DisconnectCause.REJECTED));
            WaveChatTelecomManager.unregisterConnection(callId);
            Intent intent = CallAlertUtils.mainActivityIntent(context, callId, "decline");
            intent.putExtra("callerName", callerName);
            intent.putExtra("kind", kind);
            intent.putExtra("conversationId", conversationId);
            context.startActivity(intent);
            destroy();
        }

    }
}