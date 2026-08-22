import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SourceNote } from '../components/SourceNote';
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
      <Card title={propertyAddress} subtitle="The property this workspace is about." testID="workspace-address" />

      <Card
        title="What we know"
        subtitle="Every figure shows its source and how confident we are in it."
      >
        {MOCK_PROPERTY_FACTS.map((fact) => (
          <View key={fact.id} style={styles.fact} testID={`fact-${fact.id}`}>
            <View style={styles.factHeader}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.display.value}</Text>
            </View>
            <SourceNote of={fact.display} />
          </View>
        ))}
        <Text style={styles.note}>
          Something off? Tell a licensed agent — corrections you make are marked as yours, and they
          outrank the record.
        </Text>
      </Card>

      <Card title="Documents" subtitle="What we need, and why we need it.">
        {MOCK_DOCUMENTS.map((document) => (
          <View key={document.id} style={styles.document}>
            <View style={styles.documentHeader}>
              <Text style={styles.documentLabel}>{document.label}</Text>
              <Text
                style={[
                  styles.status,
                  document.status === 'needed' ? styles.statusNeeded : styles.statusOptional,
                ]}
              >
                {STATUS_LABEL[document.status]}
              </Text>
            </View>
            <Text style={styles.documentWhy}>{document.why}</Text>
          </View>
        ))}
        <Text style={styles.note}>
          Uploads land in chunk 4. In this build the list is here so you can see what a listing
          actually asks of you before you commit.
        </Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  fact: {
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap: theme.space.xxs,
  },
  factHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.space.md,
  },
  factLabel: {
    ...theme.textStyle.body,
    color: theme.color.textSecondary,
    flex: 1,
  },
  factValue: {
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
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
    ...theme.textStyle.bodyStrong,
    color: theme.color.textPrimary,
    flex: 1,
  },
  documentWhy: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
  status: {
    ...theme.textStyle.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusNeeded: {
    color: theme.color.uncertaintyMedium,
  },
  statusOptional: {
    color: theme.color.textSecondary,
  },
  note: {
    ...theme.textStyle.caption,
    color: theme.color.textSecondary,
  },
});
