import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function PrivacyScreen(_props: RootStackScreenProps<'Privacy'>) {
  return (
    <ScreenScaffold
      route={ROUTES.Privacy}
      title="Privacy & your data"
      intro="What we collect, why, who sees it, and how long we keep it — in the same plain language as the rest of the app."
    >
      <PlaceholderNote chunk={3}>
        The privacy disclosure and the per-consent record ship with the trust UI. This route exists
        now so the entry point is never missing from a build.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
