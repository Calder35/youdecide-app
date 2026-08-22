import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROUTES, type RouteName } from '../navigation/routes';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

export const GET_HUMAN_LABEL = 'Get a human';
export const GET_HUMAN_TEST_ID = 'get-human-bar';

/**
 * Persistent human-handoff affordance.
 *
 * Non-negotiable #1: this is visible on EVERY screen, at all times, and it is
 * rendered by `ScreenScaffold` rather than by individual screens so a screen
 * cannot forget it (see the test that walks every route and asserts it).
 *
 * Tapping carries the current route through as `from`, which is what lets the
 * handoff screen tell the seller exactly what context transfers with the
 * request — never a silent send.
 */
export function GetHumanBar() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={GET_HUMAN_LABEL}
        accessibilityHint="Opens the handoff screen, which shows what information is shared with a licensed Nevada agent before anything is sent."
        testID={GET_HUMAN_TEST_ID}
        onPress={() =>
          navigation.navigate(ROUTES.GetHuman, { from: route.name as RouteName })
        }
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.label}>{GET_HUMAN_LABEL}</Text>
        <Text style={styles.sublabel}>
          A licensed Nevada agent — you&rsquo;ll see what gets shared first
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.layout.screenPaddingHorizontal,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.md,
  },
  button: {
    minHeight: theme.hitTarget.min,
    backgroundColor: theme.color.humanSurface,
    borderWidth: 1,
    borderColor: theme.color.human,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    justifyContent: 'center',
  },
  buttonPressed: {
    borderColor: theme.color.humanPressed,
  },
  label: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.humanPressed,
  },
  sublabel: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
    marginTop: theme.space.xxs,
  },
});
