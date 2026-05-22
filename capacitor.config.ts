import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wavechat.app',
  appName: 'WaveChat',
  webDir: 'dist/client',
  // Hosted mode: app loads from production URL so TanStack Start SSR works.
  // Native APIs (push, call UI) still work via Capacitor bridge.
  server: {
    url: 'https://webconnectchat.com',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['alert', 'sound', 'badge'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: false,
  },
};

export default config;
