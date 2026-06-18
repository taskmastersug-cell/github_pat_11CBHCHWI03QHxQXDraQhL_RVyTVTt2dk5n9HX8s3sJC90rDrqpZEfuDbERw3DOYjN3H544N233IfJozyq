import React, { useState } from 'react';
import { Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../src/ui/Screen';
import { Button } from '../../src/ui/Button';
import { theme } from '../../src/ui/theme';
import { useKycDraft } from '../../src/stores/kyc';
import { mintKycUploadUrl, submitKyc } from '../../src/firebase/callables';

export default function SelfieScreen() {
  const { t } = useTranslation();
  const nin = useKycDraft((s) => s.nin);
  const resetDraft = useKycDraft((s) => s.reset);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  };

  const submit = async () => {
    if (!photo) { setError(t('errors.selfieRequired')); return; }
    if (!nin) { setError(t('errors.generic')); return; }
    setBusy(true);
    try {
      const blob = await (await fetch(photo)).blob();
      const { uploadUrl, storagePath } = await mintKycUploadUrl({ contentType: blob.type || 'image/jpeg' });
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } });
      await submitKyc({ nin, selfieStoragePath: storagePath });
      resetDraft();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.h1}>{t('kyc.selfieTitle')}</Text>
      <Text style={styles.sub}>{t('kyc.selfieSubtitle')}</Text>
      {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : null}
      <Button label={t('kyc.selfieCapture')} onPress={capture} variant="secondary" />
      <Button label={t('kyc.selfiePick')} onPress={pick} variant="secondary" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Button label={t('kyc.submit')} onPress={submit} loading={busy} disabled={!photo} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
  preview: { width: '100%', aspectRatio: 1, borderRadius: theme.radius.lg, backgroundColor: theme.color.border },
  err: { color: theme.color.error, fontSize: theme.font.small },
});
