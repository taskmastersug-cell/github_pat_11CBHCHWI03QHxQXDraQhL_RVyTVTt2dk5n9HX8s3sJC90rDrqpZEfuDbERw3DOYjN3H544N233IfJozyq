import React from 'react';
import { Text, FlatList, View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { theme } from '../../src/ui/theme';
import { Money } from '../../src/ui/Money';
import { useAuth } from '../../src/stores/auth';
import { useMyChamas } from '../../src/data/chamas';

const TYPE_KEYS: Record<string, string> = {
  merryGoRound: 'chama.typeMerryGoRound',
  fixedSavings: 'chama.typeFixedSavings',
  welfare: 'chama.typeWelfare',
};

export default function ChamaListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const uid = useAuth((s) => s.user?.uid ?? null);
  const { chamas, loading } = useMyChamas(uid);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: t('chama.listTitle') }} />
      {loading ? (
        <Text style={styles.muted}>...</Text>
      ) : chamas.length === 0 ? (
        <Text style={styles.muted}>{t('chama.empty')}</Text>
      ) : (
        <FlatList
          data={chamas}
          keyExtractor={(c) => c.chamaId}
          contentContainerStyle={{ gap: theme.space.md }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(app)/chama/${item.chamaId}`)}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{t(TYPE_KEYS[item.type] ?? '')}</Text>
              <View style={styles.row}>
                <Text style={styles.meta}>{t('chama.memberCount', { count: item.memberCount })}</Text>
                <Money amount={item.contributionAmount} style={styles.amount} />
              </View>
            </Pressable>
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
  name: { fontSize: theme.font.h2, fontWeight: '700', color: theme.color.text },
  meta: { fontSize: theme.font.small, color: theme.color.muted },
  amount: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space.xs },
  muted: { color: theme.color.muted },
});
