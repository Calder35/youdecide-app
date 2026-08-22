import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FooterLinks } from '../components/FooterLinks';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { MOCK_TIMELINE } from '../data/mock';
import type { TimelineEntry } from '../data/types';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

const STATE_LABEL: Record<TimelineEntry['state'], string> = {
  done: 'Done',
  inProgress: 'In progress',
  waitingOnHuman: 'With a licensed agent',
  upcoming: 'Not started',
};

export function StatusScreen(_props: RootStackScreenProps<'Status'>) {
  const { state, propertyAddress } = useSellerSession();
  const requests = state.humanRequests;
  const latest = requests[requests.length - 1];

  return (
    <ScreenScaffold
      route={ROUTES.Status}
      title="Where things stand"
      intro="What's done, what you're waiting on, and who has it right now."
    >
      {latest !== undefined ? (
        <Card
          tone="human"
          title="A licensed agent has your request"
          subtitle={`Sent from ${latest.from} · typically answered within one business day`}
          testID="status-request"
        >
          <Text style={styles.body}>
            {latest.note.trim().length > 0
              ? `Your note: “${latest.note.trim()}”`
              : 'You did not add a note — the agent still gets your workspace and plan.'}
          </Text>
          {requests.length > 1 && (
            <Text style={styles.note}>{requests.length} requests sent in this session.</Text>
          )}
        </Card>
      ) : (
        <Card title="No request open" testID="status-no-request">
          <Text style={styles.body}>
            You haven&rsquo;t asked for a human yet. The bar at the bottom of every screen does it,
            and it shows what gets shared before anything is sent.
          </Text>
        </Card>
      )}

      <Card title={propertyAddress} subtitle="Your listing" />

      <Card title="Your listing, step by step">
        {MOCK_TIMELINE.map((entry) => (
          <View key={entry.id} style={styles.entry} testID={`timeline-${entry.id}`}>
            <View style={[styles.marker, markerStyle[entry.state]]} accessibilityElementsHidden />
            <View style={styles.entryCopy}>
              <Text style={styles.entryLabel}>{entry.label}</Text>
              <Text style={styles.entryDetail}>{entry.detail}</Text>
              <Text style={[styles.entryState, stateTextStyle[entry.state]]}>
                {STATE_LABEL[entry.state]}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <FooterLinks />
    </ScreenScaffold>
  );
}

const markerStyle: Record<TimelineEntry['state'], { backgroundColor: string }> = {
  done: { backgroundColor: theme.color.uncertaintyHigh },
  inProgress: { backgroundColor: theme.color.actionPrimary },
  waitingOnHuman: { backgroundColor: theme.color.human },
  upcoming: { backgroundColor: theme.color.border },
};

const stateTextStyle: Record<TimelineEntry['state'], { color: string }> = {
  done: { color: theme.color.uncertaintyHigh },
  inProgress: { color: theme.color.actionPrimary },
  waitingOnHuman: { color: theme.color.humanPressed },
  upcoming: { color: theme.color.textSecondary },
};

const styles = StyleSheet.create({
  body: {
    ...theme.textStyle.body,
    color: theme.color.textPrimary,
  },
  note: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  entry: {
    flexDirection: 'row',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
    marginTop: 6,
  },
  entryCopy: {
    flex: 1,
    gap: theme.space.xxs,
  },
  entryLabel: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
  },
  entryDetail: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  entryState: {
    ...theme.textStyle.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
