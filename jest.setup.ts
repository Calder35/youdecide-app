// @testing-library/react-native ships its jest matchers (toBeOnTheScreen, …)
// built in as of v12.4, so there is nothing to import for those.

// react-native-screens enables native screen containers at import time; the
// stub keeps the test tree plain RN views so queries match real components.
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return { ...actual, enableScreens: jest.fn() };
});

// LogBox is React Native's on-device warning overlay. It updates its own state
// on a timer, which produces a stream of "not wrapped in act(...)" noise that
// buries any REAL act warning from our components. Stubbing the overlay does
// not silence warnings themselves — console.warn/error still print.
jest.mock('react-native/Libraries/LogBox/LogBox', () => ({
  __esModule: true,
  default: {
    ignoreLogs: jest.fn(),
    ignoreAllLogs: jest.fn(),
    uninstall: jest.fn(),
    install: jest.fn(),
  },
}));
