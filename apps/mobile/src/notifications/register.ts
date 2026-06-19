import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerFcmToken } from '../firebase/callables';

let lastRegisteredToken: string | null = null;

export async function registerPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted;
  if (!granted && settings.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.['firebaseProjectId'] as string | undefined;
  const tokenResp = await Notifications.getDevicePushTokenAsync();
  const token = tokenResp.data;
  if (typeof token !== 'string' || token.length === 0) return null;
  if (token === lastRegisteredToken) return token;

  await registerFcmToken({ token });
  lastRegisteredToken = token;
  return token;
}

export function setForegroundHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
