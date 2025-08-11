/**
 * Unit tests for useTranscription hook
 * 
 * Tests real-time transcription functionality including:
 * - Input transcription (user speech)
 * - Output transcription (AI speech)
 * - Recording state management
 * - Transcription segment handling
 * - Error states and edge cases
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTranscription } from '../use-transcription';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { TestDataFactory } from '../../__tests__/utils/test-data-factory';
import { MockGenAILiveClient } from '../../__mocks__/google-genai-live-client';

// Mock the LiveAPI context
jest.mock('../../contexts/LiveAPIContext');
const mockUseLiveAPIContext = useLiveAPIContext as jest.MockedFunction<typeof useLiveAPIContext>;

describe('useTranscription', () => {
  let mockClient: MockGenAILiveClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh mock client for each test
    mockClient = new MockGenAILiveClient();
    
    // Setup default mock implementation
    mockUseLiveAPIContext.mockReturnValue({
      client: mockClient,
      connected: true,
      connect: jest.fn(),
      disconnect: jest.fn()
    });
  });

  describe('initial state', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTranscription());

      expect(result.current.inputTranscription).toEqual({
        currentTranscript: '',
        isTranscribing: false,
        status: 'idle'
      });

      expect(result.current.outputTranscription).toEqual({
        currentTranscript: '',
        isTranscribing: false,
        status: 'idle'
      });

      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('input transcription handling', () => {
    it('should handle input transcription segments', () => {
      const { result } = renderHook(() => useTranscription());
      
      const segment1 = TestDataFactory.createMockTranscriptionSegment({
        text: 'Hello',
        isFinal: false
      });

      act(() => {
        result.current.handleInputTranscription(segment1);
      });

      expect(result.current.inputTranscription).toEqual({
        currentTranscript: 'Hello',
        isTranscribing: true,
        status: 'processing'
      });
    });

    it('should accumulate input transcription segments', () => {
      const { result } = renderHook(() => useTranscription());
      
      const segments = [
        TestDataFactory.createMockTranscriptionSegment({
          text: 'Hello',
          isFinal: false
        }),
        TestDataFactory.createMockTranscriptionSegment({
          text: 'world',
          isFinal: false
        }),
        TestDataFactory.createMockTranscriptionSegment({
          text: '!',
          isFinal: true
        })
      ];

      act(() => {
        segments.forEach(segment => {
          result.current.handleInputTranscription(segment);
        });
      });

      expect(result.current.inputTranscription).toEqual({
        currentTranscript: 'Hello world !',
        isTranscribing: false,
        status: 'complete'
      });
    });

    it('should handle final input transcription segments', () => {
      const { result } = renderHook(() => useTranscription());
      
      const finalSegment = TestDataFactory.createMockTranscriptionSegment({
        text: 'Complete sentence',
        isFinal: true
      });

      act(() => {
        result.current.handleInputTranscription(finalSegment);
      });

      expect(result.current.inputTranscription).toEqual({
        currentTranscript: 'Complete sentence',
        isTranscribing: false,
        status: 'complete'
      });
    });
  });

  describe('output transcription handling', () => {
    it('should handle output transcription segments', () => {
      const { result } = renderHook(() => useTranscription());
      
      const segment = TestDataFactory.createMockTranscriptionSegment({
        text: 'AI response',
        isFinal: false
      });

      act(() => {
        result.current.handleOutputTranscription(segment);
      });

      expect(result.current.outputTranscription).toEqual({
        currentTranscript: 'AI response',
        isTranscribing: true,
        status: 'processing'
      });
    });

    it('should accumulate output transcription segments', () => {
      const { result } = renderHook(() => useTranscription());
      
      const segments = [
        TestDataFactory.createMockTranscriptionSegment({
          text: 'I am',
          isFinal: false
        }),
        TestDataFactory.createMockTranscriptionSegment({
          text: 'here to help',
          isFinal: true
        })
      ];

      act(() => {
        segments.forEach(segment => {
          result.current.handleOutputTranscription(segment);
        });
      });

      expect(result.current.outputTranscription).toEqual({
        currentTranscript: 'I am here to help',
        isTranscribing: false,
        status: 'complete'
      });
    });
  });

  describe('recording controls', () => {
    it('should start input transcription when connected', () => {
      const { result } = renderHook(() => useTranscription());

      act(() => {
        result.current.startInputTranscription();
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.inputTranscription.isTranscribing).toBe(true);
      expect(result.current.inputTranscription.status).toBe('recording');
      expect(result.current.inputTranscription.error).toBeUndefined();
    });

    it('should not start transcription when not connected', () => {
      mockUseLiveAPIContext.mockReturnValue({
        client: mockClient,
        connected: false,
        connect: jest.fn(),
        disconnect: jest.fn()
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const { result } = renderHook(() => useTranscription());

      act(() => {
        result.current.startInputTranscription();
      });

      expect(result.current.isRecording).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Cannot start transcription: Live API not connected'
      );

      consoleSpy.mockRestore();
    });

    it('should clear input segments when starting transcription', () => {
      const { result } = renderHook(() => useTranscription());

      // Add some existing segments
      act(() => {
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'Previous text',
            isFinal: true
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('Previous text');

      // Start new transcription
      act(() => {
        result.current.startInputTranscription();
      });

      // Current transcript should remain, but new segments will replace it
      act(() => {
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'New text',
            isFinal: true
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('New text');
    });

    it('should stop input transcription', () => {
      const { result } = renderHook(() => useTranscription());

      // Start transcription first
      act(() => {
        result.current.startInputTranscription();
      });

      expect(result.current.isRecording).toBe(true);

      // Stop transcription
      act(() => {
        result.current.stopInputTranscription();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.inputTranscription.isTranscribing).toBe(false);
    });

    it('should set correct status when stopping transcription', () => {
      const { result } = renderHook(() => useTranscription());

      // Start and add some transcript
      act(() => {
        result.current.startInputTranscription();
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'Some text',
            isFinal: false
          })
        );
      });

      // Stop transcription
      act(() => {
        result.current.stopInputTranscription();
      });

      expect(result.current.inputTranscription.status).toBe('complete');

      // Test stopping without any transcript
      act(() => {
        result.current.clearTranscriptions();
        result.current.startInputTranscription();
        result.current.stopInputTranscription();
      });

      expect(result.current.inputTranscription.status).toBe('idle');
    });
  });

  describe('clearing transcriptions', () => {
    it('should clear all transcriptions', () => {
      const { result } = renderHook(() => useTranscription());

      // Add some transcriptions
      act(() => {
        result.current.startInputTranscription();
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'Input text',
            isFinal: true
          })
        );
        result.current.handleOutputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'Output text',
            isFinal: true
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('Input text');
      expect(result.current.outputTranscription.currentTranscript).toBe('Output text');

      // Clear transcriptions
      act(() => {
        result.current.clearTranscriptions();
      });

      expect(result.current.inputTranscription).toEqual({
        currentTranscript: '',
        isTranscribing: false,
        status: 'idle'
      });

      expect(result.current.outputTranscription).toEqual({
        currentTranscript: '',
        isTranscribing: false,
        status: 'idle'
      });

      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('memoization', () => {
    it('should memoize callback functions', () => {
      const { result, rerender } = renderHook(() => useTranscription());
      
      const firstRender = {
        startInputTranscription: result.current.startInputTranscription,
        stopInputTranscription: result.current.stopInputTranscription,
        clearTranscriptions: result.current.clearTranscriptions,
        handleInputTranscription: result.current.handleInputTranscription,
        handleOutputTranscription: result.current.handleOutputTranscription
      };

      rerender();

      expect(result.current.startInputTranscription).toBe(firstRender.startInputTranscription);
      expect(result.current.stopInputTranscription).toBe(firstRender.stopInputTranscription);
      expect(result.current.clearTranscriptions).toBe(firstRender.clearTranscriptions);
      expect(result.current.handleInputTranscription).toBe(firstRender.handleInputTranscription);
      expect(result.current.handleOutputTranscription).toBe(firstRender.handleOutputTranscription);
    });

    it('should recreate callbacks when dependencies change', () => {
      const { result, rerender } = renderHook(() => useTranscription());
      
      const firstCallback = result.current.startInputTranscription;

      // Change the connected state
      mockUseLiveAPIContext.mockReturnValue({
        client: mockClient,
        connected: false,
        connect: jest.fn(),
        disconnect: jest.fn()
      });

      rerender();

      expect(result.current.startInputTranscription).toBe(firstCallback);
    });
  });

  describe('edge cases', () => {
    it('should handle empty transcription segments', () => {
      const { result } = renderHook(() => useTranscription());

      act(() => {
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: '',
            isFinal: true
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('');
      expect(result.current.inputTranscription.status).toBe('complete');
    });

    it('should handle multiple rapid transcription updates', () => {
      const { result } = renderHook(() => useTranscription());

      const segments = Array.from({ length: 10 }, (_, i) =>
        TestDataFactory.createMockTranscriptionSegment({
          text: `word${i}`,
          isFinal: i === 9
        })
      );

      act(() => {
        segments.forEach(segment => {
          result.current.handleInputTranscription(segment);
        });
      });

      const expectedText = segments.map(s => s.text).join(' ');
      expect(result.current.inputTranscription.currentTranscript).toBe(expectedText);
      expect(result.current.inputTranscription.isTranscribing).toBe(false);
    });

    it('should handle transcription segments with whitespace', () => {
      const { result } = renderHook(() => useTranscription());

      act(() => {
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: '  hello  ',
            isFinal: false
          })
        );
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: '  world  ',
            isFinal: true
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('hello     world');
    });
  });

  describe('concurrent transcriptions', () => {
    it('should handle simultaneous input and output transcriptions', () => {
      const { result } = renderHook(() => useTranscription());

      act(() => {
        result.current.handleInputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'User speaking',
            isFinal: false
          })
        );
        result.current.handleOutputTranscription(
          TestDataFactory.createMockTranscriptionSegment({
            text: 'AI responding',
            isFinal: false
          })
        );
      });

      expect(result.current.inputTranscription.currentTranscript).toBe('User speaking');
      expect(result.current.outputTranscription.currentTranscript).toBe('AI responding');
      expect(result.current.inputTranscription.isTranscribing).toBe(true);
      expect(result.current.outputTranscription.isTranscribing).toBe(true);
    });
  });
});