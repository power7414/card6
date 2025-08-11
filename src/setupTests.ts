/**
 * Test Setup Configuration
 * 
 * This file configures the testing environment with all necessary polyfills,
 * mocks, and global utilities for comprehensive testing.
 */

import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import 'web-audio-test-api';
import 'resize-observer-polyfill/dist/ResizeObserver.global';

// Mock Web Audio API
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createAnalyser: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      frequencyBinCount: 512,
      getByteFrequencyData: jest.fn(),
      getFloatFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
      getFloatTimeDomainData: jest.fn(),
      fftSize: 2048,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8
    })),
    createGain: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: {
        value: 1,
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      }
    })),
    createOscillator: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: {
        value: 440,
        setValueAtTime: jest.fn()
      },
      type: 'sine'
    })),
    createScriptProcessor: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null
    })),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn()
    })),
    destination: {
      connect: jest.fn(),
      disconnect: jest.fn()
    },
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    suspend: jest.fn(),
    resume: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});

// Mock MediaRecorder
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    state: 'inactive',
    mimeType: 'audio/webm',
    stream: null,
    ondataavailable: null,
    onstop: null,
    onstart: null,
    onpause: null,
    onresume: null,
    onerror: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn(() => [{
        stop: jest.fn(),
        getSettings: jest.fn(() => ({
          width: 1280,
          height: 720,
          frameRate: 30
        })),
        applyConstraints: jest.fn(),
        clone: jest.fn(),
        enabled: true,
        id: 'test-track-id',
        kind: 'audioinput',
        label: 'Test Microphone',
        muted: false,
        readyState: 'live',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }]),
      getAudioTracks: jest.fn(() => []),
      getVideoTracks: jest.fn(() => []),
      active: true,
      id: 'test-stream-id',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }),
    enumerateDevices: jest.fn().mockResolvedValue([
      {
        deviceId: 'test-audio-input',
        kind: 'audioinput',
        label: 'Test Microphone',
        groupId: 'test-group-1'
      },
      {
        deviceId: 'test-audio-output',
        kind: 'audiooutput', 
        label: 'Test Speaker',
        groupId: 'test-group-2'
      }
    ])
  }
});

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'blob:test-url')
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn()
});

// Mock window.confirm and window.prompt
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(() => true)
});

Object.defineProperty(window, 'prompt', {
  writable: true,
  value: jest.fn(() => 'Test Input')
});

// Mock window.alert
Object.defineProperty(window, 'alert', {
  writable: true,
  value: jest.fn()
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }))
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock localStorage for tests that don't use fake-indexeddb
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(), 
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string): R;
    }
  }
}

// Console error suppression for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('Warning: validateDOMNesting') ||
       args[0].includes('Not implemented: HTMLCanvasElement.prototype.getContext'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Reset all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});