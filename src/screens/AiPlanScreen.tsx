import { Button } from '../components/Button';
import { PlaceholderNote } from '../components/PlaceholderNote';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { ROUTES } from '../navigation/routes';
import type { RootStackScreenProps } from '../navigation/types';

export function AiPlanScreen({ navigation }: RootStackScreenProps<'AiPlan'>) {
  return (
    <ScreenScaffold
      route={ROUTES.AiPlan}
      title="Your listing plan"
      intro="What You Decide AI suggests you do next, in order, with what it based each step on. Nothing here goes live on its own — a licensed agent approves anything that leaves the app."
      actions={
        <>
          <Button
            label="Ask a licensed agent to review this"
            testID="cta-request-human"
            accessibilityHint="Opens the handoff screen, which lists what is shared before anything is sent."
            onPress={() => navigation.navigate(ROUTES.GetHuman, { from: ROUTES.AiPlan })}
          />
          <Button
            label="Continue"
            variant="secondary"
            testID="cta-continue"
            onPress={() => navigation.navigate(ROUTES.Status)}
          />
        </>
      }
    >
      <PlaceholderNote chunk={2}>
        The prep checklist and pricing narrative render here, each item carrying its source and a
        confidence level. Requesting review is the moment the human takes over — chunk 4 wires it to
        the backend&rsquo;s request-human endpoint and its audit event.
      </PlaceholderNote>
    </ScreenScaffold>
  );
}
