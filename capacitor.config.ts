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
      // Console for project wavechat-fe92e. Used as idToken audience by the
      // Android SDK and must match the Client ID configured in Supabase Auth.
      clientId: '209558207951-ujjpp8l4h0h4cnqlg4visarfq8mu3ce5.apps.googleusercontent.com',
      androidClientId: '209558207951-ujjpp8l4h0h4cnqlg4visarfq8mu3ce5.apps.googleusercontent.com',
      serverClientId: '209558207951-ujjpp8l4h0h4cnqlg4visarfq8mu3ce5.apps.googleusercontent.com',
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
