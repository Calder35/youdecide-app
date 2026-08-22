import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GET_HUMAN_TEST_ID } from '../components/GetHumanBar';
import { RootNavigator } from '../navigation/RootNavigator';
import { SELLER_FLOW } from '../navigation/routes';

// react-native-testing-library v14 renders and fires events asynchronously —
// every `render`/`fireEvent` below is awaited for that reason.

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderApp() {
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

/** Continue presses needed to get from Welcome to the end of the flow. */
const STEPS_TO_END = SELLER_FLOW.length - 1;

/**
 * A stack keeps earlier screens mounted, so a testID can legitimately match
 * more than once. The last match is the screen on top — the one a person is
 * actually looking at.
 */
function onTopScreen(testID: string) {
  const matches = screen.getAllByTestId(testID);
  return matches[matches.length - 1];
}

describe('navigation shell', () => {
  it('opens on the welcome screen', async () => {
    await renderApp();
    expect(screen.getByText('Sell your Nevada home for a 1% listing fee')).toBeOnTheScreen();
  });

  it('walks the whole scripted seller flow with the continue action', async () => {
    await renderApp();
    for (let i = 0; i < STEPS_TO_END; i += 1) {
      await fireEvent.press(onTopScreen('cta-continue'));
    }
    expect(screen.getByText('Where things stand')).toBeOnTheScreen();
  });

  it('shows the persistent "get a human" bar on every screen of the flow', async () => {
    await renderApp();
    expect(onTopScreen(GET_HUMAN_TEST_ID)).toBeOnTheScreen();
    for (let i = 0; i < STEPS_TO_END; i += 1) {
      await fireEvent.press(onTopScreen('cta-continue'));
      expect(onTopScreen(GET_HUMAN_TEST_ID)).toBeOnTheScreen();
    }
  });

  it('reaches the handoff from mid-flow and names where the request came from', async () => {
    await renderApp();
    await fireEvent.press(onTopScreen('cta-continue')); // → AccountConsent
    await fireEvent.press(onTopScreen(GET_HUMAN_TEST_ID));
    expect(screen.getByText('Talk to a licensed Nevada agent')).toBeOnTheScreen();
    expect(screen.getByText('What transfers with this request')).toBeOnTheScreen();
    expect(screen.getByText(/Where you asked from: AccountConsent/)).toBeOnTheScreen();
  });

  it('shows the handoff bar on the handoff screen too, so help is never a dead end', async () => {
    await renderApp();
    await fireEvent.press(onTopScreen(GET_HUMAN_TEST_ID));
    expect(screen.getByText('Talk to a licensed Nevada agent')).toBeOnTheScreen();
    expect(onTopScreen(GET_HUMAN_TEST_ID)).toBeOnTheScreen();
  });

  it('opens privacy from the welcome screen', async () => {
    await renderApp();
    await fireEvent.press(onTopScreen('link-privacy'));
    expect(screen.getByText('Privacy & your data')).toBeOnTheScreen();
  });

  it('opens account deletion from the welcome screen', async () => {
    await renderApp();
    await fireEvent.press(onTopScreen('link-delete-account'));
    expect(screen.getByText('Delete your account')).toBeOnTheScreen();
  });
});
