// Native call integration using @capgo/capacitor-incoming-call-kit
// This only runs inside the Capacitor native app, not in browser PWA.

import { IncomingCallKit } from '@capgo/capacitor-incoming-call-kit';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

let callKitListenersInitialized = false;
let fcmToken: string | null = null;

function isNativePushEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Request all required permissions for incoming calls */
export async function requestCallPermissions(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await IncomingCallKit.requestPermissions();
    if (isAndroid()) {
      await IncomingCallKit.requestFullScreenIntentPermission();
    }
  } catch (e) {
    console.error('Failed to request call permissions', e);
  }
}

/** Register FCM push token and save to backend */
export async function registerNativePush(
  saveTokenFn: (token: string, platform: 'android' | 'ios') => Promise<void>,
): Promise<void> {
  if (!isNativeApp()) return;
  if (!isNativePushEnabled()) {
    console.info('Native push disabled: Firebase configuration not available in this build');
    return;
  }

  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    // Listen for registration token
    PushNotifications.addListener('registration', async (token) => {
      fcmToken = token.value;
      const platform = isAndroid() ? 'android' : 'ios';
      try {
        await saveTokenFn(token.value, platform);
        console.log('FCM token registered', platform, token.value.slice( 0, 20) + '...');
      } catch (e) {
        console.error('Failed to save FCM token', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err);
    });

    // Listen for push received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      handleNativePushPayload(notification.data);
    });

    // Listen for action performed (user tapped notification or button)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleNativePushPayload(action.notification.data);
    });
  } catch (e) {
    console.error('Native push registration failed', e);
  }
}

/** Handle push payload for calls */
function handleNativePushPayload(data?: Record<string, unknown>): void {
  if (!data || data.type !== 'call') return;
  const callId = data.callId as string | undefined;
  const callerName = data.callerName as string | undefined;
  const kind = data.kind as string | undefined;
  const conversationId = data.conversationId as string | undefined;

  if (!callId) return;

  // Dispatch a custom event that the React app listens to
  window.dispatchEvent(
    new CustomEvent('wavechat-native-call', {
      detail: { callId, callerName, kind, conversationId },
    }),
  );
}

/** Show native incoming-call UI (ringtone + full-screen) */
export async function showNativeIncomingCall(params: {
  callId: string;
  callerName: string;
  hasVideo: boolean;
  extra?: Record<string, string>;
}): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await IncomingCallKit.showIncomingCall({
      callId: params.callId,
      callerName: params.callerName,
      handle: params.callerName,
      appName: 'WaveChat',
      hasVideo: params.hasVideo,
      timeoutMs: 45_000,
      extra: params.extra ?? {},
      android: {
        channelId: 'wavechat_incoming_calls_v2',
        channelName: 'Chamadas WaveChat',
        showFullScreen: true,
        isHighPriority: true,
      },
      ios: {
        handleType: 'generic',
      },
    });
  } catch (e) {
    console.error('Failed to show native incoming call', e);
  }
}

/** End a native call UI and clear any related FCM notifications/vibration */
export async function endNativeCall(callId: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await IncomingCallKit.endCall({ callId });
  } catch (e) {
    console.error('Failed to end native call', e);
  }
  // Also dismiss the FCM-posted incoming-call notification, which carries
  // its own vibration pattern and would otherwise keep buzzing after
  // accept/decline/cancel.
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (e) {
    console.error('Failed to clear delivered notifications', e);
  }
  // Force-stop any ongoing system vibration as a last resort.
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([]);
      navigator.vibrate?.(0);
    }
  } catch {
    /* ignore */
  }
}

/** Initialize listeners for call events from the native plugin */
export async function initNativeCallListeners(handlers: {
  onAccept: (callId: string, extra: Record<string, string>) => void;
  onDecline: (callId: string) => void;
  onEnd: (callId: string) => void;
  onTimeout: (callId: string) => void;
}): Promise<() => void> {
  if (!isNativeApp() || callKitListenersInitialized) return () => {};
  callKitListenersInitialized = true;

  const handleAccept = await IncomingCallKit.addListener('callAccepted', (event: any) => {
    handlers.onAccept(event.callId, event.extra ?? {});
  });

  const handleDecline = await IncomingCallKit.addListener('callDeclined', (event: any) => {
    handlers.onDecline(event.callId);
  });

  const handleEnd = await IncomingCallKit.addListener('callEnded', (event: any) => {
    handlers.onEnd(event.callId);
  });

  const handleTimeout = await IncomingCallKit.addListener('callTimedOut', (event: any) => {
    handlers.onTimeout(event.callId);
  });

  return () => {
    handleAccept?.remove();
    handleDecline?.remove();
    handleEnd?.remove();
    handleTimeout?.remove();
    callKitListenersInitialized = false;
  };
}
