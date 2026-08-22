import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function PropertyWorkspaceScreen({ navigation }: RootStackScreenProps<'PropertyWorkspace'>) {
  return (
    <ScreenScaffold
      route={ROUTES.PropertyWorkspace}
      title="Your property workspace"
      intro="Everything about this home in one place: the facts we pulled, the ones you corrected, photos, and documents. Each figure will show its source and how confident we are in it."
      actions={
        <Button
          label="Continue"
          testID="cta-continue"
          onPress={() => navigation.navigate(ROUTES.AiPlan)}
        />
      }
    >
      <PlaceholderNote chunk={2}>
        Property facts, documents, and photo slots — mock data in chunk 2, backed by the workspace
        endpoint in chunk 4. Chunk 3 adds the source-and-confidence display each fact carries.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
