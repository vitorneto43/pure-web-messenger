import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wavechat.app',
  appName: 'WaveChat',
  webDir: 'capacitor-app',
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
      launchShowDuration: 3000,
      backgroundColor: '#0c2340',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
