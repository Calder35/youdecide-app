import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type Props = {
  label: string;
  /** The thing being agreed to, in full. Never truncated behind a link. */
  body?: string;
  checked: boolean;
  onToggle: () => void;
  /** Shown next to the label so a seller can see what is optional. */
  requirement?: 'required' | 'optional';
  testID?: string;
};

export function Checkbox({ label, body, checked, onToggle, requirement, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={body}
      onPress={onToggle}
      testID={testID}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>
          {label}
          {requirement !== undefined && (
            <Text style={requirement === 'required' ? styles.required : styles.optional}>
              {requirement === 'required' ? '  Required' : '  Optional'}
            </Text>
          )}
        </Text>
        {body !== undefined && <Text style={styles.body}>{body}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.space.md,
    minHeight: theme.hitTarget.min,
    paddingVertical: theme.space.sm,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.color.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    marginTop: theme.space.xxs,
  },
  boxChecked: {
    backgroundColor: theme.color.actionPrimary,
  },
  check: {
    color: theme.color.actionPrimaryText,
    ...theme.textStyle.bodyStrong,
    lineHeight: 20,
  },
  copy: {
    flex: 1,
    gap: theme.space.xxs,
  },
  label: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  required: {
    ...theme.textStyle.micro,
    color: theme.color.uncertaintyLow,
  },
  optional: {
    ...theme.textStyle.micro,
    color: theme.color.textSecondary,
  },
  body: {
    ...theme.textStyle.body,
    color: theme.color.textSecondary,
  },
});
