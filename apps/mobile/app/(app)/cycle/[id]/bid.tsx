import React, { useState } from 'react';
import { Text, View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../src/ui/Screen';
import { theme } from '../../../../src/ui/theme';
import { Money } from '../../../../src/ui/Money';
import { Button } from '../../../../src/ui/Button';
import { Field } from '../../../../src/ui/Field';
import { useCycle, useBids } from '../../../../src/data/chamas';
import { useAuth } from '../../../../src/stores/auth';
import { placeBid } from '../../../../src/firebase/callables';
import { lowestActiveDiscount } from '../../../../src/bid/lowestActiveDiscount';

export default function BidScreen() {
  const { t } = useTranslation();
  const { id, chamaId } = useLocalSearchParams<{ id: string; chamaId: string }>();
  const uid = useAuth((s) => s.user?.uid ?? null);
  const cycle = useCycle(chamaId ?? null, id ?? null);
  const bids = useBids(chamaId ?? null, id ?? null);

  const [discount, setDiscount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const myBid = bids.find((b) => b.uid === uid && b.status === 'active');
  const lowest = lowestActiveDiscount(bids);
  const bidWindowOpen = cycle?.state === 'bidding' &&
    (cycle.biddingClosesAt == null || Date.now() <= cycle.biddingClosesAt);

  const submit = async () => {
    const n = Number(discount);
    if (!Number.isInteger(n) || n < 0) { setError(t('errors.generic')); return; }
    if (!chamaId || !id) return;
    setError(null);
    setBusy(true);
    try {
      await placeBid({ chamaId, cycleId: id, discount: n });
      setDiscount('');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('bid.title') }} />
      <Text style={styles.sub}>{t('bid.subtitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{bidWindowOpen ? t('bid.open') : t('bid.closed')}</Text>
        {myBid ? (
          <View style={styles.row}>
            <Text style={styles.meta}>{t('bid.myBid')}</Text>
            <Money amount={myBid.discount} style={styles.amount} />
            <Text style={lowest === myBid.discount ? styles.success : styles.err}>
              {lowest === myBid.discount ? t('bid.winning') : t('bid.outbid')}
            </Text>
          </View>
        ) : null}
      </View>

      {bidWindowOpen ? (
        <View style={styles.section}>
          <Field
            label={t('bid.discountLabel')}
            value={discount}
            onChangeText={setDiscount}
            keyboardType="number-pad"
            error={error ?? undefined}
          />
          <Button label={t('bid.submit')} onPress={submit} loading={busy} />
        </View>
      ) : null}

      <View style={styles.section}>
        {bids.length === 0 ? (
          <Text style={styles.meta}>{t('bid.noBids')}</Text>
        ) : (
          <FlatList
            data={bids}
            keyExtractor={(b) => b.bidId}
            contentContainerStyle={{ gap: theme.space.xs }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.meta}>{item.uid === uid ? t('bid.myBid') : item.uid.slice(0, 6)}</Text>
                <Money amount={item.discount} style={styles.amount} />
                <Text style={styles.meta}>{item.status}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        )}
      </View>
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
  label: { fontSize: theme.font.small, color: theme.color.muted, fontWeight: '600' },
  sub: { fontSize: theme.font.body, color: theme.color.muted },
  meta: { fontSize: theme.font.small, color: theme.color.muted },
  amount: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.sm },
  success: { color: theme.color.success, fontWeight: '600', fontSize: theme.font.small },
  err: { color: theme.color.warn, fontWeight: '600', fontSize: theme.font.small },
});
