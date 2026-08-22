import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { InlineError } from './Errors';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Why we're asking. Shown, not tucked behind an info icon. */
  help?: string;
  /** Returns a plain-language problem, or null. Runs after the first blur. */
  validate?: (value: string) => string | null;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: 'name' | 'email' | 'tel' | 'postal-code' | 'off';
  multiline?: boolean;
  testID?: string;
};

/**
 * A labelled text input.
 *
 * Validation runs on blur, never on every keystroke — telling someone their
 * email is wrong while they are still typing it is noise, not help.
 *
 * Accessibility: the label, the help text, and any error are all part of what a
 * screen reader announces for the input, so none of them depend on being able
 * to see what sits next to the box.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  help,
  validate,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete = 'off',
  multiline = false,
  testID,
}: Props) {
  const [touched, setTouched] = useState(false);
  const error = touched && validate !== undefined ? validate(value) : null;

  const hint = [help, error ?? undefined].filter(Boolean).join(' ');

  return (
    <View style={styles.container}>
      <AppText role="bodyStrong">{label}</AppText>
      {help !== undefined && (
        <AppText role="caption" tone="secondary">
          {help}
        </AppText>
      )}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint.length > 0 ? hint : undefined}
        aria-invalid={error !== null}
        value={value}
        onChangeText={onChangeText}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textPlaceholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        multiline={multiline}
        testID={testID}
        style={[styles.input, multiline && styles.multiline, error !== null && styles.inputError]}
      />
      {error !== null && (
        <InlineError
          message={error}
          testID={testID !== undefined ? `${testID}-error` : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space.xs,
  },
  input: {
    minHeight: theme.hitTarget.min,
    borderWidth: 1,
    borderColor: theme.color.controlBorder,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  inputError: {
    borderColor: theme.color.uncertaintyLow,
    borderWidth: 2,
  },
  multiline: {
    minHeight: theme.hitTarget.min * 2,
    textAlignVertical: 'top',
  },
});
