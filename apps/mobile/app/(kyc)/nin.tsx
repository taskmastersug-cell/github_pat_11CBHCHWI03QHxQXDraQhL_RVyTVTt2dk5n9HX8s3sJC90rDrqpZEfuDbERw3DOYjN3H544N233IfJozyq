import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Field } from '../../src/ui/Field';
import { Button } from '../../src/ui/Button';
import { theme } from '../../src/ui/theme';
import { useKycDraft } from '../../src/stores/kyc';
import { useAuth } from '../../src/stores/auth';
import { useUserDoc } from '../../src/data/userDoc';

export default function NinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setDraftNin = useKycDraft((s) => s.setNin);
  const uid = useAuth((s) => s.user?.uid ?? null);
  const { user } = useUserDoc(uid);

  if (user?.kyc?.status === 'pending') {
    return (
      <Screen>
        <Text style={styles.h1}>{t('kyc.pendingTitle')}</Text>
        <Text style={styles.sub}>{t('kyc.pendingBody')}</Text>
      </Screen>
    );
  }
  if (user?.kyc?.status === 'rejected') {
    return (
      <Screen>
        <Text style={styles.h1}>{t('kyc.rejectedTitle')}</Text>
        <Text style={styles.sub}>{t('kyc.rejectedBody')}</Text>
      </Screen>
    );
  }

  const onNext = () => {
    if (nin.trim().length !== 14) { setError(t('errors.invalidNin')); return; }
    setDraftNin(nin.trim());
    router.push('/(kyc)/selfie');
  };

  return (
    <Screen>
      <Text style={styles.h1}>{t('kyc.ninTitle')}</Text>
      <Text style={styles.sub}>{t('kyc.ninSubtitle')}</Text>
      <Field
        label={t('kyc.ninLabel')}
        value={nin}
        onChangeText={setNin}
        autoCapitalize="characters"
        maxLength={14}
        error={error ?? undefined}
      />
      <Button label={t('kyc.submit')} onPress={onNext} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
});
