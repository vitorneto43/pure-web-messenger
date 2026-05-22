import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wavechat.app',
  appName: 'WaveChat',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    cleartext: false,
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
    // Allow http cleartext for local dev; production uses https
    allowMixedContent: false,
  },
};

export default config;
