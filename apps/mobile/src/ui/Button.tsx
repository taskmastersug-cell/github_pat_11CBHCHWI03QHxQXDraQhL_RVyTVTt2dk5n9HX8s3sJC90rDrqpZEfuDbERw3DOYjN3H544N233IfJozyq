import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { theme } from './theme';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  testID?: string;
};

export function Button({ label, onPress, loading, disabled, variant = 'primary', testID }: Props) {
  const isDisabled = disabled || loading;
  const styles = variant === 'primary' ? primary : secondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.btn, isDisabled && styles.disabled, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={styles.text.color} /> : null}
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const baseRow = { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

const primary = StyleSheet.create({
  btn: {
    backgroundColor: theme.color.primary,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  row: baseRow,
  text: { color: theme.color.primaryText, fontSize: theme.font.body, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const secondary = StyleSheet.create({
  btn: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  row: baseRow,
  text: { color: theme.color.text, fontSize: theme.font.body, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
