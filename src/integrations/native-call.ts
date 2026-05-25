// Native call integration — FCM-only implementation.
// We removed the previous @capgo/capacitor-incoming-call-kit plugin because
// it produced uncontrollable vibration loops and conflicted with the WebRTC
// audio session (causing noise on accept). Incoming-call UI on Android is
// now handled entirely by the FCM full-screen-intent notification posted by
// WaveChatMessagingService.java (no vibration, no extra audio session).

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';

const WaveChatCall = registerPlugin<{
  stopAlerts(options: { callId?: string }): Promise<{ ok: boolean }>;
  stopRinging(options: { callId?: string }): Promise<{ ok: boolean }>;
  configureAudio(): Promise<{ ok: boolean }>;
  resetAudio(): Promise<{ ok: boolean }>;
  setSpeaker(options: { on: boolean }): Promise<{ ok: boolean }>;
  setBadge(options: { count: number }): Promise<{ ok: boolean }>;
  getRingtone(): Promise<{ uri: string | null; name: string | null; isDefault: boolean }>;
  clearRingtone(): Promise<{ ok: boolean }>;
  pickRingtone(): Promise<{ ok: boolean; cancelled?: boolean; uri?: string; name?: string }>;
  previewRingtone(): Promise<{ ok: boolean }>;
  stopPreviewRingtone(): Promise<{ ok: boolean }>;
}>('WaveChatCall');

export async function setNativeSpeakerphone(on: boolean): Promise<void> {
  if (!isNativeApp()) return;
  try { await WaveChatCall.setSpeaker({ on }); } catch (e) { console.error(e); }
}

export async function setNativeBadge(count: number): Promise<void> {
  if (!isNativeApp()) return;
  try { await WaveChatCall.setBadge({ count: Math.max(0, count | 0) }); } catch (e) { console.error(e); }
}

export async function getNativeRingtone(): Promise<{ uri: string | null; name: string | null; isDefault: boolean } | null> {
  if (!isNativeApp()) return null;
  try { return await WaveChatCall.getRingtone(); } catch (e) { console.error(e); return null; }
}

export async function pickNativeRingtone(): Promise<{ ok: boolean; uri?: string; name?: string; cancelled?: boolean } | null> {
  if (!isNativeApp()) return null;
  try { return await WaveChatCall.pickRingtone(); } catch (e) { console.error(e); return null; }
}

export async function clearNativeRingtone(): Promise<void> {
  if (!isNativeApp()) return;
  try { await WaveChatCall.clearRingtone(); } catch (e) { console.error(e); }
}

export async function previewNativeRingtone(): Promise<void> {
  if (!isNativeApp()) return;
  try { await WaveChatCall.previewRingtone(); } catch (e) { console.error(e); }
}

export async function stopPreviewNativeRingtone(): Promise<void> {
  if (!isNativeApp()) return;
  try { await WaveChatCall.stopPreviewRingtone(); } catch (e) { console.error(e); }
}

let registered = false;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function hasNativePushConfig(): boolean {
  return isNativeApp() || import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';
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
  if (registered) return;
  registered = true;

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
    registered = false;
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
    await WaveChatCall.stopAlerts({ callId: _callId });
  } catch (e) {
    console.error('Failed to stop native call alerts', e);
  }
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

export async function stopNativeRinging(_callId: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await WaveChatCall.stopRinging({ callId: _callId });
  } catch (e) {
    console.error('Failed to stop native ringing', e);
  }
}

export async function configureNativeCallAudio(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await WaveChatCall.configureAudio();
  } catch (e) {
    console.error('Failed to configure native call audio', e);
  }
}

export async function resetNativeCallAudio(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await WaveChatCall.resetAudio();
  } catch (e) {
    console.error('Failed to reset native call audio', e);
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
