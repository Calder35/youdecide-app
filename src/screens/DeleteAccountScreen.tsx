import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function DeleteAccountScreen(_props: RootStackScreenProps<'DeleteAccount'>) {
  return (
    <ScreenScaffold
      route={ROUTES.DeleteAccount}
      title="Delete your account"
      intro="What deletion removes, what we're required to keep, and how long it takes. No retention traps."
    >
      <PlaceholderNote chunk={3}>
        The deletion request flow lands with the trust UI. Deletion is a high-consequence action, so
        it follows the same rule as the rest of the app: a person confirms it.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
