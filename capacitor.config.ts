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
    GoogleAuth: {
      // Google Web OAuth Client ID (type "Web application") from Google Cloud
      // Console for project wavechat-fe92e. REQUIRED for native sign-in: the
      // Android SDK uses it as the audience for the idToken, and the same ID
      // must be added as an authorized client in Supabase Auth → Google.
      // TODO: fill in with the real Web Client ID before building the APK.
      serverClientId: 'REPLACE_WITH_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: true,
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
