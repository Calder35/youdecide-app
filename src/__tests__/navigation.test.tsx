import { screen } from '@testing-library/react-native';

import { CHAT_SCREEN_TEST_ID } from '../screens/ChatScreen';
import { SELLER_FLOW } from '../navigation/routes';
import {
  giveRequiredConsents,
  onTop,
  pressOnTop,
  renderApp,
  renderIntake,
} from '../test-utils/renderApp';

describe('the front door', () => {
  it('opens on the conversation with You Decide AI', async () => {
    await renderApp();
    expect(onTop(CHAT_SCREEN_TEST_ID)).toBeOnTheScreen();
    // Named in the header, the greeting, and on the AI's own turns.
    expect(screen.getAllByText('You Decide AI').length).toBeGreaterThan(0);
    expect(screen.getByText(/What's on your mind\?/)).toBeOnTheScreen();
  });

  it('reaches privacy from the conversation', async () => {
    await renderApp();
    await pressOnTop('link-privacy');
    expect(screen.getByText('Privacy & your data')).toBeOnTheScreen();
  });

  it('reaches account deletion from privacy', async () => {
    await renderApp();
    await pressOnTop('link-privacy');
    await pressOnTop('cta-delete-account');
    expect(screen.getByText('Delete your account')).toBeOnTheScreen();
  });
});

describe('the intake flow, once a person gets there', () => {
  it('still walks end to end', async () => {
    await renderIntake();
    await pressOnTop('cta-continue'); // Welcome → AccountConsent
    await giveRequiredConsents();
    for (let i = 0; i < SELLER_FLOW.length - 2; i += 1) {
      await pressOnTop('cta-continue');
    }
    expect(screen.getByText('Where things stand')).toBeOnTheScreen();
  });

  it('opens privacy and account deletion from the welcome screen', async () => {
    await renderIntake();
    await pressOnTop('link-privacy');
    expect(screen.getByText('Privacy & your data')).toBeOnTheScreen();
  });

  it('reaches the fee explanation, which is no longer part of the opening', async () => {
    await renderIntake();
    await pressOnTop('cta-see-fee');
    expect(screen.getByText('What the 1% covers')).toBeOnTheScreen();
  });
});
