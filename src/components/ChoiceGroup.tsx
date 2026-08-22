import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  testIDPrefix?: string;
};

/** A single-select list of pill options. Radio semantics for screen readers. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  testIDPrefix,
}: Props<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={option}
              testID={testIDPrefix !== undefined ? `${testIDPrefix}-${slug(option)}` : undefined}
              onPress={() => onChange(option)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space.sm,
  },
  label: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  option: {
    minHeight: theme.hitTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  optionSelected: {
    borderColor: theme.color.actionPrimary,
    backgroundColor: theme.color.sourceSurface,
  },
  optionText: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  optionTextSelected: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.actionPrimaryPressed,
  },
});
