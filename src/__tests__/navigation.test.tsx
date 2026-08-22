import { screen } from '@testing-library/react-native';

import { GET_HUMAN_TEST_ID } from '../components/GetHumanBar';
import {
  giveRequiredConsents,
  onTop,
  pressOnTop,
  renderApp,
} from '../test-utils/renderApp';

describe('navigation shell', () => {
  it('opens on the welcome screen', async () => {
    await renderApp();
    expect(screen.getByText('Sell your Nevada home for a 1% listing fee')).toBeOnTheScreen();
  });

  it('walks the scripted seller flow end to end', async () => {
    await renderApp();
    await pressOnTop('cta-continue'); // Welcome → AccountConsent
    await giveRequiredConsents();
    await pressOnTop('cta-continue'); // → SellerDiscovery
    await pressOnTop('cta-continue'); // → OnePercent
    await pressOnTop('cta-continue'); // → PropertyWorkspace
    await pressOnTop('cta-continue'); // → AiPlan
    await pressOnTop('cta-continue'); // → Status
    expect(screen.getByText('Where things stand')).toBeOnTheScreen();
  });

  it('shows the persistent "get a human" bar on every screen of the flow', async () => {
    await renderApp();
    expect(onTop(GET_HUMAN_TEST_ID)).toBeOnTheScreen();

    await pressOnTop('cta-continue');
    expect(onTop(GET_HUMAN_TEST_ID)).toBeOnTheScreen();

    await giveRequiredConsents();
    for (let i = 0; i < 5; i += 1) {
      await pressOnTop('cta-continue');
      expect(onTop(GET_HUMAN_TEST_ID)).toBeOnTheScreen();
    }
  });

  it('shows the handoff bar on the handoff screen too, so help is never a dead end', async () => {
    await renderApp();
    await pressOnTop(GET_HUMAN_TEST_ID);
    expect(screen.getByText('Talk to a licensed Nevada agent')).toBeOnTheScreen();
    expect(onTop(GET_HUMAN_TEST_ID)).toBeOnTheScreen();
  });

  it('opens privacy from the welcome screen', async () => {
    await renderApp();
    await pressOnTop('link-privacy');
    expect(screen.getByText('Privacy & your data')).toBeOnTheScreen();
  });

  it('opens account deletion from the welcome screen', async () => {
    await renderApp();
    await pressOnTop('link-delete-account');
    expect(screen.getByText('Delete your account')).toBeOnTheScreen();
  });

  it('reaches the fee explanation directly from welcome', async () => {
    await renderApp();
    await pressOnTop('cta-see-fee');
    expect(screen.getByText('What the 1% covers')).toBeOnTheScreen();
  });
});
