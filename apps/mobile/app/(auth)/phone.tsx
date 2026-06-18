import React, { useState, useRef } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecaptchaVerifier } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Field } from '../../src/ui/Field';
import { Button } from '../../src/ui/Button';
import { theme } from '../../src/ui/theme';
import { useAuth } from '../../src/stores/auth';
import { firebase } from '../../src/firebase/init';

export default function PhoneScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const startPhoneSignIn = useAuth((s) => s.startPhoneSignIn);
  const recaptchaContainerRef = useRef<View>(null);

  const onSubmit = async () => {
    setError(null);
    if (!/^\+\d{9,15}$/.test(phone)) {
      setError(t('errors.invalidPhone'));
      return;
    }
    setBusy(true);
    try {
      const { auth } = firebase();
      const verifier = Platform.OS === 'web'
        ? new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
        : ({ verify: async () => 'mock-recaptcha-token' } as unknown as RecaptchaVerifier);
      await startPhoneSignIn(phone, verifier);
      router.push('/(auth)/otp');
    } catch (e) {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.h1}>{t('auth.phoneTitle')}</Text>
      <Text style={styles.sub}>{t('auth.phoneSubtitle')}</Text>
      <Field
        label={t('auth.phoneLabel')}
        placeholder={t('auth.phonePlaceholder')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={error ?? undefined}
      />
      <Button label={t('auth.sendCode')} onPress={onSubmit} loading={busy} />
      <View nativeID="recaptcha-container" ref={recaptchaContainerRef} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
});
