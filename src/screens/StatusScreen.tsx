import { FooterLinks } from '../components/FooterLinks';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function StatusScreen(_props: RootStackScreenProps<'Status'>) {
  return (
    <ScreenScaffold
      route={ROUTES.Status}
      title="Where things stand"
      intro="What's done, what you're waiting on, and who has it right now."
    >
      <PlaceholderNote chunk={2}>
        The timeline of the seller&rsquo;s listing — steps completed, the open request with a
        licensed agent, and what happens next.
      </PlaceholderNote>
      <FooterLinks />
    </ScreenScaffold>
  );
}
