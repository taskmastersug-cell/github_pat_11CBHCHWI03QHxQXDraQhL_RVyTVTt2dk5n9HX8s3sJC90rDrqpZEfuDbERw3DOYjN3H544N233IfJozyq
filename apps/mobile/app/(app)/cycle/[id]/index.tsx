import React, { useState } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/ui/Screen';
import { theme } from '../../../../src/ui/theme';
import { Money } from '../../../../src/ui/Money';
import { Button } from '../../../../src/ui/Button';
import { Field } from '../../../../src/ui/Field';
import { useCycle, useMyContribution } from '../../../../src/data/chamas';
import { useTransaction } from '../../../../src/data/transactions';
import { useAuth } from '../../../../src/stores/auth';
import { initiateContribution } from '../../../../src/firebase/callables';

const STATUS_KEYS: Record<string, string> = {
  pending: 'cycle.statusPending',
  paid: 'cycle.statusPaid',
  late: 'cycle.statusLate',
  waived: 'cycle.statusWaived',
};

export default function CycleDetailScreen() {
  const { t } = useTranslation();
  const { id, chamaId } = useLocalSearchParams<{ id: string; chamaId: string }>();
  const router = useRouter();
  const uid = useAuth((s) => s.user?.uid ?? null);
  const cycle = useCycle(chamaId ?? null, id ?? null);
  const contribution = useMyContribution(chamaId ?? null, id ?? null, uid);

  const [msisdn, setMsisdn] = useState('');
  const [provider, setProvider] = useState<'mtnMomo' | 'airtelMoney'>('mtnMomo');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tx = useTransaction(txId);

  const canContribute = contribution && (contribution.state === 'pending' || contribution.state === 'late');

  const onContribute = async () => {
    if (!chamaId || !contribution) return;
    if (!/^\+?\d{9,15}$/.test(msisdn)) { setError(t('errors.generic')); return; }
    setError(null);
    setBusy(true);
    try {
      const result = await initiateContribution({
        chamaId, contributionId: contribution.contributionId, provider, msisdn,
      });
      setTxId(result.txId);
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('cycle.title', { index: (cycle?.index ?? 0) + 1 }) }} />
      {cycle ? (
        <View style={styles.section}>
          <Text style={styles.label}>{t('cycle.pool')}</Text>
          <Money amount={cycle.pool} style={styles.big} />
        </View>
      ) : null}
      {contribution ? (
        <View style={styles.section}>
          <Text style={styles.label}>{t('cycle.myContribution')}</Text>
          <Money amount={contribution.amount} style={styles.amount} />
          <Text style={styles.meta}>{t(STATUS_KEYS[contribution.state] ?? '')}</Text>
        </View>
      ) : null}

      {cycle?.state === 'bidding' ? (
        <Button
          label={t('bid.title')}
          variant="secondary"
          onPress={() => router.push(`/(app)/cycle/${id}/bid?chamaId=${chamaId}`)}
        />
      ) : null}

      {canContribute && !txId ? (
        <View style={styles.section}>
          <Text style={styles.h2}>{t('contribute.title')}</Text>
          <View style={styles.providerRow}>
            <Button
              label={t('contribute.providerMtn')}
              variant={provider === 'mtnMomo' ? 'primary' : 'secondary'}
              onPress={() => setProvider('mtnMomo')}
            />
            <Button
              label={t('contribute.providerAirtel')}
              variant={provider === 'airtelMoney' ? 'primary' : 'secondary'}
              onPress={() => setProvider('airtelMoney')}
            />
          </View>
          <Field
            label={t('contribute.msisdnLabel')}
            value={msisdn}
            onChangeText={setMsisdn}
            keyboardType="phone-pad"
            error={error ?? undefined}
          />
          <Button label={t('contribute.submit')} onPress={onContribute} loading={busy} />
        </View>
      ) : null}

      {txId ? (
        <View style={styles.section}>
          <Text style={styles.h2}>{t('contribute.instructionsTitle')}</Text>
          <Text style={styles.sub}>
            {t('contribute.instructionsBody', { provider: provider === 'mtnMomo' ? 'MTN MoMo' : 'Airtel Money' })}
          </Text>
          {tx?.state === 'confirmed' ? (
            <Text style={styles.success}>{t('contribute.success')}</Text>
          ) : tx?.state === 'failed' ? (
            <Text style={styles.err}>{t('contribute.failed')}</Text>
          ) : (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text style={styles.meta}>{t('contribute.waiting')}</Text>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  h2: { fontSize: theme.font.h2, fontWeight: '600', color: theme.color.text },
  label: { fontSize: theme.font.small, color: theme.color.muted, fontWeight: '600' },
  big: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  amount: { fontSize: theme.font.h2, fontWeight: '600', color: theme.color.text },
  meta: { fontSize: theme.font.small, color: theme.color.muted },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
  providerRow: { flexDirection: 'row', gap: theme.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  success: { color: theme.color.success, fontWeight: '600', fontSize: theme.font.body },
  err: { color: theme.color.error, fontWeight: '600', fontSize: theme.font.body },
});
