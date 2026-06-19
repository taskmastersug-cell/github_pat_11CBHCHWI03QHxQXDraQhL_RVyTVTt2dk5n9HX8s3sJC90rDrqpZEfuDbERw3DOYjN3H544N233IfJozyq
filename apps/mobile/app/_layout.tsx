import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { firebase } from '../src/firebase/init';
import { useAuth } from '../src/stores/auth';
import { useUserDoc } from '../src/data/userDoc';
import { initI18n } from '../src/i18n';
import { theme } from '../src/ui/theme';
import { registerPushNotifications, setForegroundHandler } from '../src/notifications/register';
import { useNotificationDeepLinks } from '../src/notifications/deepLink';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    firebase();
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) return <Loading />;
  return (
    <SafeAreaProvider>
      <AuthGate />
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const init = useAuth((s) => s.init);
  const user = useAuth((s) => s.user);
  const authReady = useAuth((s) => s.ready);
  const { user: profile, loading: profileLoading } = useUserDoc(user?.uid ?? null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { init(); setForegroundHandler(); }, [init]);

  const kycApproved = profile?.kyc?.status === 'approved';
  useEffect(() => {
    if (kycApproved) {
      registerPushNotifications().catch(() => {});
    }
  }, [kycApproved]);

  useNotificationDeepLinks(kycApproved);

  useEffect(() => {
    if (!authReady) return;
    const inAuth = segments[0] === '(auth)';
    const inKyc = segments[0] === '(kyc)';

    if (!user) {
      if (!inAuth) router.replace('/(auth)/phone');
      return;
    }
    if (profileLoading) return;

    const kycStatus = profile?.kyc?.status ?? 'unstarted';
    if (kycStatus !== 'approved') {
      if (!inKyc) router.replace('/(kyc)/nin');
      return;
    }
    if (inAuth || inKyc) router.replace('/');
  }, [authReady, user, profile, profileLoading, segments, router]);

  if (!authReady || (user && profileLoading)) return <Loading />;
  return <Slot />;
}

function Loading() {
  return (
    <View style={styles.center}><ActivityIndicator /></View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
});
