import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '../navigation/RootNavigator';
import { SellerSessionProvider } from '../state/SellerSession';

/**
 * Renders the real app — real navigator, real session store — so tests exercise
 * what a person actually uses. `@testing-library/react-native` v14 is async, so
 * every helper here returns a promise.
 */

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export async function renderApp() {
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SellerSessionProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SellerSessionProvider>
    </SafeAreaProvider>,
  );
}

/**
 * A stack keeps earlier screens mounted, so a testID can match more than once.
 * The last match belongs to the screen on top — the one a person is looking at.
 */
export function onTop(testID: string) {
  const matches = screen.getAllByTestId(testID);
  return matches[matches.length - 1];
}

export async function pressOnTop(testID: string) {
  await fireEvent.press(onTop(testID));
}

export async function typeInto(testID: string, text: string) {
  await fireEvent.changeText(onTop(testID), text);
}

/** Give the two required consents — the only gate in the flow. */
export async function giveRequiredConsents() {
  await pressOnTop('consent-terms');
  await pressOnTop('consent-dataUse');
}
