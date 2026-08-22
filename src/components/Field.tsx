import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { theme } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Why we're asking. Shown, not tucked behind an info icon. */
  help?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  testID?: string;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  help,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline = false,
  testID,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {help !== undefined && <Text style={styles.help}>{help}</Text>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textDisabled}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        testID={testID}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space.xs,
  },
  label: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  help: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  input: {
    minHeight: theme.hitTarget.min,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  multiline: {
    minHeight: theme.hitTarget.min * 2,
    textAlignVertical: 'top',
  },
});
