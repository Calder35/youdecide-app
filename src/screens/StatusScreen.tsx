import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, type TextTone } from '../components/AppText';
import { ApiStatusNote } from '../components/ApiStatusNote';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/Errors';
import { FooterLinks } from '../components/FooterLinks';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { describeAuditAction } from '../api/sellerIntake';
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

const STATE_TONE: Record<TimelineEntry['state'], TextTone> = {
  done: 'success',
  inProgress: 'action',
  waitingOnHuman: 'human',
  upcoming: 'secondary',
};

export function StatusScreen(_props: RootStackScreenProps<'Status'>) {
  const { state, propertyAddress, refreshAudit, isConnected } = useSellerSession();
  const requests = state.humanRequests;
  const latest = requests[requests.length - 1];
  const { auditTrail, error, pending } = state.remote;

  // The audit trail is the backend's own record of what happened. Reading it
  // here is deliberate: the seller sees what the system wrote about them, not
  // a summary we composed.
  useEffect(() => {
    void refreshAudit();
  }, [refreshAudit]);

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
          <AppText>
            {latest.note.trim().length > 0
              ? `Your note: “${latest.note.trim()}”`
              : 'You did not add a note — the agent still gets your workspace and plan.'}
          </AppText>
          {requests.length > 1 && (
            <AppText role="caption" tone="secondary">
              {requests.length} requests sent in this session.
            </AppText>
          )}
          <AppText role="micro" tone={latest.synced ? 'success' : 'secondary'} uppercase testID="request-sync-state">
            {latest.synced
              ? 'Delivered to the test API'
              : isConnected
                ? 'Recorded on this device — not delivered'
                : 'Recorded on this device'}
          </AppText>
        </Card>
      ) : (
        <Card title="No request open" testID="status-no-request">
          <AppText>
            You haven&rsquo;t asked for a human yet. The bar at the bottom of every screen does it,
            and it shows what gets shared before anything is sent.
          </AppText>
        </Card>
      )}

      <Card title={propertyAddress} subtitle="Your listing" />

      <Card title="Your listing, step by step">
        {MOCK_TIMELINE.map((entry) => (
          <View key={entry.id} style={styles.entry} testID={`timeline-${entry.id}`}>
            <View style={[styles.marker, markerStyle[entry.state]]} accessibilityElementsHidden />
            <View style={styles.entryCopy}>
              <AppText role="bodyStrong">{entry.label}</AppText>
              <AppText role="caption" tone="secondary">
                {entry.detail}
              </AppText>
              <AppText role="micro" tone={STATE_TONE[entry.state]} uppercase>
                {STATE_LABEL[entry.state]}
              </AppText>
            </View>
          </View>
        ))}
      </Card>

      {error !== null && (
        <ErrorBanner
          title="We could not read your record"
          message={error.message}
          testID="status-error"
          action={
            error.retryable ? (
              <Button
                label="Try again"
                variant="secondary"
                testID="cta-retry-audit"
                onPress={refreshAudit}
              />
            ) : undefined
          }
        />
      )}

      {isConnected && (
        <Card
          title="What the system recorded"
          subtitle="The backend's own audit trail for your workspace. Append-only — nothing here can be edited or removed, including by us."
          testID="audit-trail"
        >
          {auditTrail.length === 0 ? (
            <AppText role="caption" tone="secondary">
              {pending === 'audit' ? 'Reading your record…' : 'Nothing recorded yet.'}
            </AppText>
          ) : (
            auditTrail.map((entry) => (
              <View key={entry.seq} style={styles.auditRow} testID={`audit-${entry.seq}`}>
                <AppText role="micro" tone="secondary" style={styles.auditSeq}>
                  {entry.seq}
                </AppText>
                <AppText style={styles.auditLabel}>{describeAuditAction(entry.action)}</AppText>
              </View>
            ))
          )}
        </Card>
      )}

      <ApiStatusNote />

      <FooterLinks />
    </ScreenScaffold>
  );
}

const markerStyle: Record<TimelineEntry['state'], { backgroundColor: string }> = {
  done: { backgroundColor: theme.color.uncertaintyHigh },
  inProgress: { backgroundColor: theme.color.actionPrimary },
  waitingOnHuman: { backgroundColor: theme.color.human },
  upcoming: { backgroundColor: theme.color.controlBorder },
};

const styles = StyleSheet.create({
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
  auditRow: {
    flexDirection: 'row',
    gap: theme.space.md,
    paddingVertical: theme.space.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  auditSeq: {
    minWidth: 20,
  },
  auditLabel: {
    flex: 1,
  },
});
