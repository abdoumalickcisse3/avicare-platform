// Global Jest setup for the mobile app.

// Native speech-recognition module has no JS impl under Jest — mock it so any
// test that renders the assistant UI doesn't choke on the native binding.
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

export {};
