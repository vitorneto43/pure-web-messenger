// Native call integration — FCM-only implementation.
// We removed the previous @capgo/capacitor-incoming-call-kit plugin because
// it produced uncontrollable vibration loops and conflicted with the WebRTC
// audio session (causing noise on accept). Incoming-call UI on Android is
// now handled entirely by the FCM full-screen-intent notification posted by
// WaveChatMessagingService.java (no vibration, no extra audio session).

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

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

/** Request notification permission only (no CallKit anymore) */
export async function requestCallPermissions(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await PushNotifications.requestPermissions();
  } catch (e) {
    console.error('Failed to request push permissions', e);
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

    PushNotifications.addListener('registration', async (token) => {
      const platform = isAndroid() ? 'android' : 'ios';
      try {
        await saveTokenFn(token.value, platform);
        console.log('FCM token registered', platform, token.value.slice(0, 20) + '...');
      } catch (e) {
        console.error('Failed to save FCM token', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      handleNativePushPayload(notification.data);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleNativePushPayload(action.notification.data);
    });
  } catch (e) {
    console.error('Native push registration failed', e);
  }
}

function handleNativePushPayload(data?: Record<string, unknown>): void {
  if (!data || data.type !== 'call') return;
  const callId = data.callId as string | undefined;
  const callerName = data.callerName as string | undefined;
  const kind = data.kind as string | undefined;
  const conversationId = data.conversationId as string | undefined;

  if (!callId) return;

  window.dispatchEvent(
    new CustomEvent('wavechat-native-call', {
      detail: { callId, callerName, kind, conversationId },
    }),
  );
}

/**
 * Incoming-call UI is shown by the FCM full-screen-intent notification
 * posted server-side. In-app (foreground) ringing is handled by the React
 * IncomingCallDialog + startRingtone(). This is a no-op kept for API
 * compatibility with the previous CallKit integration.
 */
export async function showNativeIncomingCall(_params: {
  callId: string;
  callerName: string;
  hasVideo: boolean;
  extra?: Record<string, string>;
}): Promise<void> {
  return;
}

/** Dismiss any delivered call notifications and force-stop vibration. */
export async function endNativeCall(_callId: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (e) {
    console.error('Failed to clear delivered notifications', e);
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(0);
    }
  } catch {
    /* ignore */
  }
}

/**
 * No CallKit anymore — accept/decline come from the FCM notification's action
 * buttons, which are wired through CallActionReceiver → MainActivity →
 * window 'wavechat-android-intent' event (see use-call.tsx). This stub keeps
 * the previous API surface working.
 */
export async function initNativeCallListeners(_handlers: {
  onAccept: (callId: string, extra: Record<string, string>) => void;
  onDecline: (callId: string) => void;
  onEnd: (callId: string) => void;
  onTimeout: (callId: string) => void;
}): Promise<() => void> {
  return () => {};
}
