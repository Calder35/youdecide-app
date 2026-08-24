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

// expo-audio and expo-file-system are native modules. They are stubbed so the
// screen tests can render the mic; the voice PIPELINE is tested through
// `voiceTurn.ts`, which takes its recorder, player, and provider as arguments
// precisely so it does not need a device.
jest.mock('expo-audio', () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: jest.fn(() => ({
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    prepareToRecordAsync: jest.fn(async () => undefined),
    getStatus: jest.fn(() => ({ durationMillis: 2500, isRecording: false })),
    uri: 'file:///tmp/recording.m4a',
  })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false, durationMillis: 0, metering: -160 })),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
}));

jest.mock('expo-file-system', () => {
  class FakeFile {
    uri = 'file:///tmp/voice/reply.mp3';
    exists = false;
    create() {}
    delete() {}
    write() {}
    async base64() {
      return 'ZmFrZS1hdWRpbw==';
    }
  }
  class FakeDirectory {
    exists = true;
    create() {}
    delete() {}
  }
  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { cache: 'file:///tmp/cache' },
  };
});
