// @testing-library/react-native ships its jest matchers (toBeOnTheScreen, …)
// built in as of v12.4, so there is nothing to import for those.

// react-native-screens enables native screen containers at import time; the
// stub keeps the test tree plain RN views so queries match real components.
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return { ...actual, enableScreens: jest.fn() };
});

// LogBox is React Native's on-device warning overlay. Its notification
// container updates state on a timer that can fire after a test has finished,
// producing "not wrapped in act(...)" noise that buries any REAL act warning
// from our own components. Both the overlay and its store are stubbed.
//
// This silences the OVERLAY, not warnings: console.warn and console.error still
// print, so a genuine React or React Native warning is still visible in CI.
jest.mock('react-native/Libraries/LogBox/LogBox', () => ({
  __esModule: true,
  default: {
    ignoreLogs: jest.fn(),
    ignoreAllLogs: jest.fn(),
    uninstall: jest.fn(),
    install: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/LogBox/LogBoxNotificationContainer', () => ({
  __esModule: true,
  default: () => null,
  _LogBoxNotificationContainer: () => null,
}));
