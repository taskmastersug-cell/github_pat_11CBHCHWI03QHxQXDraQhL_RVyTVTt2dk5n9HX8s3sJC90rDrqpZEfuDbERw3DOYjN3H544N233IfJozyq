import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/ui/Screen';
import { theme } from '../../../../src/ui/theme';
import { Button } from '../../../../src/ui/Button';
import { requestExit } from '../../../../src/firebase/callables';

export default function ExitScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await requestExit({ chamaId: id });
      setDone(true);
      setTimeout(() => router.replace('/'), 1500);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('exit.title') }} />
      <Text style={styles.h1}>{t('exit.title')}</Text>
      <Text style={styles.sub}>{t('exit.warning')}</Text>
      {done ? (
        <Text style={styles.success}>{t('exit.pending')}</Text>
      ) : (
        <Button label={t('exit.confirm')} onPress={submit} loading={busy} />
      )}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
  success: { color: theme.color.success, fontWeight: '600', fontSize: theme.font.body },
  err: { color: theme.color.error, fontSize: theme.font.small },
});
