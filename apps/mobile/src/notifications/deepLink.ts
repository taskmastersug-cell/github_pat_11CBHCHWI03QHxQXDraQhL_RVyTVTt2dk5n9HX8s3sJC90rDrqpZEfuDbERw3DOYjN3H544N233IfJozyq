import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { routeForNotification } from '@roundpay/shared';

function navigate(router: ReturnType<typeof useRouter>, data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const path = routeForNotification(data as Record<string, unknown>);
  if (path) router.push(path as never);
}

export function useNotificationDeepLinks(enabled: boolean): void {
  const router = useRouter();

  // Cold-start: app was killed and opened from a notification tap.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (cancelled) return;
      const data = res?.notification.request.content.data;
      if (data) navigate(router, data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, router]);

  // Runtime: user taps a notification while the app is open or backgrounded.
  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigate(router, response.notification.request.content.data);
    });
    return () => sub.remove();
  }, [enabled, router]);
}
