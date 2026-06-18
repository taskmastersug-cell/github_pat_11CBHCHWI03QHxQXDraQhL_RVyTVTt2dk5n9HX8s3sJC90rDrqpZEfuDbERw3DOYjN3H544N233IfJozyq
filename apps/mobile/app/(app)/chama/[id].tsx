import React from 'react';
import { Text, View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/ui/Screen';
import { theme } from '../../../src/ui/theme';
import { Money } from '../../../src/ui/Money';
import { useChama, useCycles } from '../../../src/data/chamas';

export default function ChamaDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chama = useChama(id ?? null);
  const cycles = useCycles(id ?? null);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: chama?.name ?? '' }} />
      {chama ? (
        <View style={styles.header}>
          <Text style={styles.title}>{chama.name}</Text>
          <Text style={styles.meta}>{t('chama.memberCount', { count: chama.memberCount })}</Text>
          <Money amount={chama.contributionAmount} style={styles.amount} />
        </View>
      ) : null}
      <FlatList
        data={cycles}
        keyExtractor={(c) => c.cycleId}
        contentContainerStyle={{ gap: theme.space.md }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(app)/cycle/${item.cycleId}?chamaId=${id}`)}
          >
            <Text style={styles.name}>{t('cycle.title', { index: item.index + 1 })}</Text>
            <View style={styles.row}>
              <Text style={styles.meta}>{item.state}</Text>
              <Money amount={item.pool} style={styles.amount} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.space.xs },
  title: { fontSize: theme.font.h1, fontWeight: '700', color: theme.color.text },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    gap: theme.space.xs,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  name: { fontSize: theme.font.h2, fontWeight: '600', color: theme.color.text },
  meta: { fontSize: theme.font.small, color: theme.color.muted },
  amount: { fontSize: theme.font.body, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
