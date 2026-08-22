// @testing-library/react-native ships its jest matchers (toBeOnTheScreen, …)
// built in as of v12.4, so there is nothing to import for those.

// react-native-screens enables native screen containers at import time; the
// stub keeps the test tree plain RN views so queries match real components.
jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return { ...actual, enableScreens: jest.fn() };
});
