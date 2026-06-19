import React from 'react';
import { Text, View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/ui/Screen';
import { theme } from '../../../../src/ui/theme';
import { Money } from '../../../../src/ui/Money';
import { Button } from '../../../../src/ui/Button';
import { useClaims } from '../../../../src/data/chamas';

const STATE_KEYS: Record<string, string> = {
  submitted: 'claim.stateSubmitted',
  approved: 'claim.stateApproved',
  rejected: 'claim.stateRejected',
  paid: 'claim.statePaid',
};

export default function ClaimsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const claims = useClaims(id ?? null);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: t('claim.listTitle') }} />
      <Button
        label={t('claim.fileNew')}
        onPress={() => router.push(`/(app)/chama/${id}/claim-new`)}
      />
      {claims.length === 0 ? (
        <Text style={styles.muted}>{t('claim.empty')}</Text>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(c) => c.claimId}
          contentContainerStyle={{ gap: theme.space.md }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.reason}>{item.reason}</Text>
              <View style={styles.row}>
                <Money amount={item.amountRequested} style={styles.amount} />
                <Text style={styles.meta}>{t(STATE_KEYS[item.state] ?? '')}</Text>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  reason: { fontSize: theme.font.body, color: theme.color.text },
  meta: { fontSize: theme.font.small, color: theme.color.muted },
  amount: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  muted: { color: theme.color.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
