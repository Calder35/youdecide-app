import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ApiClient } from '../api/client';
import { RootNavigator } from '../navigation/RootNavigator';
import type { RootStackParamList } from '../navigation/types';
import { ChatSessionProvider } from '../state/ChatSession';
import { SellerSessionProvider } from '../state/SellerSession';
import { VoiceSessionProvider, type VoiceDependencies } from '../state/VoiceSession';

/**
 * Renders the real app — real navigator, real stores — so tests exercise what a
 * person actually uses. `@testing-library/react-native` v14 is async, so every
 * helper here returns a promise.
 */

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export type RenderOptions = {
  /** With none, the app runs OFFLINE and touches no network. CI needs this. */
  client?: ApiClient;
  /**
   * Defaults to the app's real front door (`Chat`). The intake tests start at
   * `Welcome` so they can exercise that flow without walking a conversation.
   */
  initialRouteName?: keyof RootStackParamList;
  /** Fake mic/player/provider. Without these, voice reports unavailable. */
  voice?: VoiceDependencies;
  /**
   * Whether spoken turns stream. Defaults to the build flag (on).
   *
   * Tests of the plain `/v1/chat` path set this false and say so, because with
   * streaming on a spoken turn does not go through that endpoint at all.
   */
  streaming?: boolean;
};

export async function renderApp(options: RenderOptions = {}) {
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SellerSessionProvider client={options.client}>
        {/* No typing delay: tests should not wait on a simulated pause. */}
        <ChatSessionProvider
          client={options.client}
          thinkingDelayMs={0}
          streaming={options.streaming}
        >
          <VoiceSessionProvider
            client={options.client}
            dependencies={{ log: () => undefined, ...options.voice }}
          >
            <NavigationContainer>
              <RootNavigator initialRouteName={options.initialRouteName} />
            </NavigationContainer>
          </VoiceSessionProvider>
        </ChatSessionProvider>
      </SellerSessionProvider>
    </SafeAreaProvider>,
  );
}

/** Starts on the intake flow rather than the conversation. */
export async function renderIntake(options: Omit<RenderOptions, 'initialRouteName'> = {}) {
  await renderApp({ ...options, initialRouteName: 'Welcome' });
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

/** Give the two required consents — the only gate in the intake flow. */
export async function giveRequiredConsents() {
  await pressOnTop('consent-terms');
  await pressOnTop('consent-dataUse');
}

/** Say something to You Decide AI and wait for the reply to land. */
export async function sayToAi(message: string) {
  await typeInto('chat-input', message);
  await pressOnTop('chat-send');
}
