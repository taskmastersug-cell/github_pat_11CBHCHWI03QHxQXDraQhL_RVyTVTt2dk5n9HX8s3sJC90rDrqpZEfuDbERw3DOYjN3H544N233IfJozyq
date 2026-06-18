import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { theme } from './theme';

type Props = TextInputProps & { label: string; error?: string | undefined };

export function Field({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={theme.color.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.xs },
  label: { fontSize: theme.font.small, color: theme.color.muted, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: theme.font.body,
    color: theme.color.text,
    backgroundColor: theme.color.surface,
  },
  inputError: { borderColor: theme.color.error },
  error: { color: theme.color.error, fontSize: theme.font.small },
});
