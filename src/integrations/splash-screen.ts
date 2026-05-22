import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor }  from '@capacitor/core';

export async function hideSplashScreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.error('Failed to hide splash screen', e);
  }
}
