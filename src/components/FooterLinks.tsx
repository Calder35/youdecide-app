import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';

import { ROUTES } from '../navigation/routes';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { AppText } from './AppText';

/**
 * Privacy and account-deletion entry points.
 *
 * Non-negotiable #4: these exist from the first build, not once there is an
 * account system to delete from. They are reachable from the entry screen and
 * from status — the two places a seller lands before and after the intake.
 */
export function FooterLinks() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Privacy and your data"
        testID="link-privacy"
        onPress={() => navigation.navigate(ROUTES.Privacy)}
        style={styles.link}
      >
        <AppText role="caption" tone="action" style={styles.text}>
          Privacy &amp; your data
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Delete your account"
        testID="link-delete-account"
        onPress={() => navigation.navigate(ROUTES.DeleteAccount)}
        style={styles.link}
      >
        <AppText role="caption" tone="action" style={styles.text}>
          Delete your account
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
  link: {
    minHeight: theme.hitTarget.min,
    justifyContent: 'center',
  },
  text: {
    textDecorationLine: 'underline',
  },
});
