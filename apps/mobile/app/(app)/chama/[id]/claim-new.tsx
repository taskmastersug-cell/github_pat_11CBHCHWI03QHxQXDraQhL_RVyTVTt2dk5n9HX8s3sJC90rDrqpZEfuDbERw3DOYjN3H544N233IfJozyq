import React, { useState } from 'react';
import { Text, View, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/ui/Screen';
import { theme } from '../../../../src/ui/theme';
import { Field } from '../../../../src/ui/Field';
import { Button } from '../../../../src/ui/Button';
import { fileClaim, mintEvidenceUploadUrl } from '../../../../src/firebase/callables';

export default function NewClaimScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickEvidence = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setEvidenceUri(res.assets[0].uri);
  };

  const submit = async () => {
    if (!id) return;
    const amt = Number(amount);
    if (!reason.trim() || !Number.isInteger(amt) || amt <= 0) {
      setError(t('errors.generic'));
      return;
    }
    if (!evidenceUri) { setError(t('claim.evidenceMissing')); return; }
    setError(null);
    setBusy(true);
    try {
      const blob = await (await fetch(evidenceUri)).blob();
      const { url, path } = await mintEvidenceUploadUrl({ chamaId: id });
      await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } });
      await fileClaim({ chamaId: id, reason: reason.trim(), amountRequested: amt, evidenceRef: path });
      router.back();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('claim.newTitle') }} />
      <Field
        label={t('claim.reasonLabel')}
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={4}
      />
      <Field
        label={t('claim.amountLabel')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
      />
      <View style={styles.evidence}>
        <Text style={styles.label}>{t('claim.evidenceLabel')}</Text>
        {evidenceUri ? <Image source={{ uri: evidenceUri }} style={styles.preview} /> : null}
        <Button label={t('claim.addEvidence')} variant="secondary" onPress={pickEvidence} />
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Button label={t('claim.submit')} onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  evidence: { gap: theme.space.sm },
  label: { fontSize: theme.font.small, color: theme.color.muted, fontWeight: '600' },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.md, backgroundColor: theme.color.border },
  err: { color: theme.color.error, fontSize: theme.font.small },
});
