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
/**
 * The recorder mock is CONTROLLABLE, because hands-free conversation is driven
 * by input levels: a test has to be able to say "they spoke, then went quiet"
 * and have the endpointing effect actually see it. `setRecorderState` pushes a
 * new level and re-renders anything reading it.
 */
const mockRecorderState: { isRecording: boolean; durationMillis: number; metering: number | null } = {
  isRecording: false,
  durationMillis: 0,
  metering: -160,
};
const mockRecorderListeners = new Set<() => void>();

(globalThis as Record<string, unknown>).setRecorderState = (
  patch: Partial<typeof mockRecorderState>,
) => {
  Object.assign(mockRecorderState, patch);
  mockRecorderListeners.forEach((listener) => listener());
};

(globalThis as Record<string, unknown>).resetRecorderState = () => {
  Object.assign(mockRecorderState, { isRecording: false, durationMillis: 0, metering: -160 });
};

jest.mock('expo-audio', () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
  // The app records with explicit options rather than a preset, so these
  // enums have to exist for the module to even load.
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
  AudioQuality: { MIN: 0, LOW: 32, MEDIUM: 64, HIGH: 96, MAX: 127 },
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: jest.fn(() => ({
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    prepareToRecordAsync: jest.fn(async () => undefined),
    // Reads the same controllable state as `useAudioRecorderState`, because
    // endpointing samples the recorder synchronously rather than waiting for a
    // re-render — a test pushing levels has to reach both.
    getStatus: jest.fn(() => ({ ...mockRecorderState })),
    uri: 'file:///tmp/recording.m4a',
  })),
  useAudioRecorderState: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const listener = () => force((n: number) => n + 1);
      mockRecorderListeners.add(listener);
      return () => {
        mockRecorderListeners.delete(listener);
      };
    }, []);
    return { ...mockRecorderState };
  },
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
}));

// The legacy async writer is what actually writes spoken replies — the modern
// synchronous File.write() failed on device with a native FunctionCallException.
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
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
