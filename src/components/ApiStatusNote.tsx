import { StyleSheet, View } from 'react-native';

import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';
import { AppText } from './AppText';

export const API_STATUS_TEST_ID = 'api-status';

/**
 * Whether anything is actually being sent, said plainly.
 *
 * A seller in a test session deserves to know which of the two they are in, and
 * so does whoever is running the session. Offline is the default and is stated
 * as a fact, not as a warning — there is nothing wrong with it.
 */
export function ApiStatusNote() {
  const { isConnected, apiBaseUrl, state } = useSellerSession();
  const { remote } = state;

  return (
    <View style={styles.container} testID={API_STATUS_TEST_ID}>
      <View style={[styles.dot, isConnected ? styles.dotLive : styles.dotOffline]} accessibilityElementsHidden />
      <View style={styles.copy}>
        <AppText role="micro" tone={isConnected ? 'success' : 'secondary'} uppercase>
          {isConnected ? 'Connected to the test API' : 'Offline — nothing is sent'}
        </AppText>
        <AppText role="caption" tone="secondary">
          {isConnected
            ? `Writing to ${apiBaseUrl}. A test backend only — never production.`
            : 'Everything on screen is sample data held on this device.'}
        </AppText>
        {isConnected && remote.sellerId !== null && (
          <AppText role="micro" tone="secondary" testID="api-status-ids">
            seller {shortId(remote.sellerId)}
            {remote.journeyId !== null ? ` · workspace ${shortId(remote.journeyId)}` : ''}
          </AppText>
        )}
      </View>
    </View>
  );
}

/** Enough of a UUID to match against a backend log, short enough to read. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: theme.space.sm,
    alignItems: 'flex-start',
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: theme.space.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    marginTop: 5,
  },
  dotLive: {
    backgroundColor: theme.color.uncertaintyHigh,
  },
  dotOffline: {
    backgroundColor: theme.color.textSecondary,
  },
  copy: {
    flex: 1,
    gap: theme.space.xxs,
  },
});
