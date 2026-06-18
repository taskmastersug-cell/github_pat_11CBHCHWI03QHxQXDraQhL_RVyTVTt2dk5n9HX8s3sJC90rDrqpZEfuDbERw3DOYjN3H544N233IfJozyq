import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/ui/Screen';
import { Field } from '../../src/ui/Field';
import { Button } from '../../src/ui/Button';
import { theme } from '../../src/ui/theme';
import { useAuth } from '../../src/stores/auth';

export default function OtpScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const phone = useAuth((s) => s.pendingPhone);
  const confirmCode = useAuth((s) => s.confirmCode);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onSubmit = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) { setError(t('errors.invalidOtp')); return; }
    setBusy(true);
    try { await confirmCode(code); }
    catch { setError(t('errors.generic')); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <Text style={styles.h1}>{t('auth.otpTitle')}</Text>
      <Text style={styles.sub}>{t('auth.otpSubtitle', { phone: phone ?? '' })}</Text>
      <Field
        label={t('auth.otpLabel')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        error={error ?? undefined}
      />
      <Button label={t('auth.verify')} onPress={onSubmit} loading={busy} />
      <Text style={styles.muted}>
        {seconds > 0 ? t('auth.resendIn', { seconds }) : t('auth.resend')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
  muted: { fontSize: theme.font.small, color: theme.color.muted, textAlign: 'center' },
});
