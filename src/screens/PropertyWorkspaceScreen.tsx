import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DraftNotice } from '../components/DraftNotice';
import { Figure } from '../components/Figure';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { MOCK_DOCUMENTS, MOCK_PROPERTY_FACTS } from '../data/mock';
import type { DocumentStatus } from '../data/types';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';
import { useSellerSession } from '../state/SellerSession';
import { theme } from '../theme';

const STATUS_LABEL: Record<DocumentStatus, string> = {
  needed: 'Needed',
  uploaded: 'Received',
  notApplicable: 'Only if you have it',
};

export function PropertyWorkspaceScreen({ navigation }: RootStackScreenProps<'PropertyWorkspace'>) {
  const { propertyAddress } = useSellerSession();

  return (
    <ScreenScaffold
      route={ROUTES.PropertyWorkspace}
      title="Your property workspace"
      intro="Everything we know about this home, and where each piece came from. Anything wrong here is worth fixing now — the whole plan is built on it."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          accessibilityHint="Goes on to your listing plan."
          onPress={() => navigation.navigate(ROUTES.AiPlan)}
        />
      }
    >
      <Card
        title={propertyAddress}
        subtitle="The property this workspace is about."
        testID="workspace-address"
      />

      <Card
        title="What we know"
        subtitle="Every figure shows its source and how confident we are in it. Tap a confidence level to see what it means."
      >
        {MOCK_PROPERTY_FACTS.map((fact) => (
          <Figure
            key={fact.id}
            label={fact.label}
            value={fact.display}
            correctedBySeller={fact.correctedBySeller}
            testID={`fact-${fact.id}`}
          />
        ))}
        <AppText role="caption" tone="secondary">
          Something off? Tell a licensed agent — corrections you make are marked as yours, and they
          outrank the record.
        </AppText>
      </Card>

      <Card title="Documents" subtitle="What we need, and why we need it.">
        {MOCK_DOCUMENTS.map((document) => (
          <View key={document.id} style={styles.document}>
            <View style={styles.documentHeader}>
              <AppText role="bodyStrong" style={styles.documentLabel}>
                {document.label}
              </AppText>
              <AppText
                role="micro"
                tone={document.status === 'needed' ? 'caution' : 'secondary'}
                uppercase
              >
                {STATUS_LABEL[document.status]}
              </AppText>
            </View>
            <AppText role="caption" tone="secondary">
              {document.why}
            </AppText>
          </View>
        ))}
        <DraftNotice />
        <AppText role="caption" tone="secondary">
          Uploads land in chunk 4. In this build the list is here so you can see what a listing
          actually asks of you before you commit.
        </AppText>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  document: {
    paddingVertical: theme.space.sm,
    gap: theme.space.xxs,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.space.md,
  },
  documentLabel: {
    flex: 1,
  },
});
