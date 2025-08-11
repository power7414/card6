/**
 * Integration tests for Transcription and Live API Workflow
 * 
 * Tests the complete transcription and voice conversation flow including:
 * - Live API connection and disconnection
 * - Real-time input transcription (user speech)
 * - Real-time output transcription (AI speech)
 * - Audio recording and playback
 * - Message creation from transcriptions
 * - Error handling and recovery
 * - Performance under load
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, waitForAsync, AudioTestUtils } from '../utils/test-helpers';
import { TestDataFactory } from '../utils/test-data-factory';
import { MockGenAILiveClient } from '../../__mocks__/google-genai-live-client';
import { mockIndexedDB } from '../../__mocks__/indexeddb-mock';

// Import components to test
import { ConversationArea } from '../../components/conversation-display/ConversationArea';
import { ChatInputArea } from '../../components/chat-input/ChatInputArea';
import { TranscriptionDisplay } from '../../components/conversation-display/TranscriptionDisplay';
import { LiveAPIContext } from '../../contexts/LiveAPIContext';

// Mock Web Audio API components
const mockAudioContext = {
  createAnalyser: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    getByteFrequencyData: jest.fn(),
    frequencyBinCount: 1024
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    gain: { value: 1 }
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  state: 'running',
  resume: jest.fn().mockResolvedValue(undefined)
};

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Test component that provides Live API context
const TranscriptionTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client] = React.useState(() => new MockGenAILiveClient());
  const [connected, setConnected] = React.useState(false);

  const connect = React.useCallback(async (model: string, config: any) => {
    const success = await client.connect(model, config);
    setConnected(success);
    return success;
  }, [client]);

  const disconnect = React.useCallback(() => {
    const success = client.disconnect();
    setConnected(false);
    return success;
  }, [client]);

  return (
    <LiveAPIContext.Provider value={{
      client,
      connected,
      connect,
      disconnect
    }}>
      {children}
    </LiveAPIContext.Provider>
  );
};

const TranscriptionIntegrationTest: React.FC = () => {
  return (
    <TranscriptionTestWrapper>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ flex: 1 }}>
          <ConversationArea />
        </div>
        <div>
          <TranscriptionDisplay />
        </div>
        <div>
          <ChatInputArea />
        </div>
      </div>
    </TranscriptionTestWrapper>
  );
};

describe('Transcription and Live API Integration', () => {
  let mockClient: MockGenAILiveClient;

  beforeEach(async () => {
    // Clear mock storage
    mockIndexedDB.__testUtils.clear();
    await mockIndexedDB.initialize();

    // Setup mock audio stream
    const mockStream = TestDataFactory.createMockMediaStream();
    mockGetUserMedia.mockResolvedValue(mockStream);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Live API Connection Management', () => {
    it('should establish connection to Live API', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Find and click connect button
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Verify connection status
      const statusIndicator = screen.getByTestId('connection-status');
      expect(statusIndicator).toHaveTextContent(/connected/i);
    });

    it('should handle connection failures gracefully', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Mock connection failure
      const mockClient = new MockGenAILiveClient({ simulateErrors: true, errorRate: 1 });
      
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should disconnect from Live API', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // First connect
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Then disconnect
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      });
    });

    it('should auto-reconnect on connection drops', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Establish connection
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Simulate connection drop
      const mockClient = new MockGenAILiveClient();
      mockClient.__testUtils.triggerEvent('close', new CloseEvent('close'));

      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });

      // Should eventually reconnect
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Input Transcription (User Speech)', () => {
    beforeEach(async () => {
      // Setup connected state
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);
      
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });
    });

    it('should start recording and show transcription', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Start recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/recording/i)).toBeInTheDocument();
      });

      // Simulate transcription updates
      const mockClient = new MockGenAILiveClient();
      
      // Simulate progressive transcription
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'Hello',
          isFinal: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });

      // Simulate more text
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'Hello world',
          isFinal: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
      });

      // Final transcription
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'Hello world, how are you?',
          isFinal: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Hello world, how are you?')).toBeInTheDocument();
      });
    });

    it('should stop recording and create message', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Start recording
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      // Simulate transcription
      const mockClient = new MockGenAILiveClient();
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'This is my question',
          isFinal: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText('This is my question')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      await user.click(stopButton);

      // Should create a user message
      await waitFor(() => {
        const messageElement = screen.getByTestId('user-message');
        expect(within(messageElement).getByText('This is my question')).toBeInTheDocument();
      });

      // Verify message is saved to storage
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms[0]?.messages).toHaveLength(1);
      expect(savedRooms[0]?.messages[0].content).toBe('This is my question');
      expect(savedRooms[0]?.messages[0].type).toBe('user');
    });

    it('should handle microphone permission errors', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/microphone permission/i)).toBeInTheDocument();
      });

      // Should show settings or help link
      expect(screen.getByRole('link', { name: /enable microphone/i })).toBeInTheDocument();
    });

    it('should handle audio processing errors gracefully', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      // Simulate audio processing error
      const mockClient = new MockGenAILiveClient();
      act(() => {
        mockClient.__testUtils.triggerEvent('error', new ErrorEvent('error', {
          message: 'Audio processing failed'
        }));
      });

      await waitFor(() => {
        expect(screen.getByText(/audio error/i)).toBeInTheDocument();
      });

      // Should provide recovery options
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Output Transcription (AI Speech)', () => {
    beforeEach(async () => {
      // Setup connected state and create initial chat room
      const chatRoom = TestDataFactory.createMockChatRoom();
      await mockIndexedDB.saveChatRoom(chatRoom);
      await mockIndexedDB.setSetting('activeChatRoom', chatRoom.id);
    });

    it('should receive and display AI transcription', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Wait for connection
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Simulate AI response transcription
      const mockClient = new MockGenAILiveClient();
      
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'I understand',
          isFinal: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('I understand')).toBeInTheDocument();
      });

      // Progressive updates
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'I understand your question',
          isFinal: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('I understand your question')).toBeInTheDocument();
      });

      // Final response
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'I understand your question and here is my response.',
          isFinal: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText('I understand your question and here is my response.')).toBeInTheDocument();
      });
    });

    it('should create assistant message from completed transcription', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Connect and simulate complete AI response
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'Here is my complete answer to your question.',
          isFinal: true
        });
      });

      // Should create assistant message
      await waitFor(() => {
        const messageElement = screen.getByTestId('assistant-message');
        expect(within(messageElement).getByText('Here is my complete answer to your question.')).toBeInTheDocument();
      });

      // Verify message is saved
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      const assistantMessage = savedRooms[0]?.messages.find(msg => msg.type === 'assistant');
      expect(assistantMessage?.content).toBe('Here is my complete answer to your question.');
    });

    it('should handle simultaneous audio and transcription', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();

      // Simulate audio data
      act(() => {
        const mockAudioBuffer = new ArrayBuffer(1024);
        mockClient.__testUtils.triggerEvent('audio', mockAudioBuffer);
      });

      // Simulate corresponding transcription
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'This is being spoken',
          isFinal: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText('This is being spoken')).toBeInTheDocument();
      });

      // Should show audio visualization
      expect(screen.getByTestId('audio-visualization')).toBeInTheDocument();
    });
  });

  describe('Conversation Flow Integration', () => {
    it('should handle complete conversation cycle', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Connect to Live API
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // 1. User speaks
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      const mockClient = new MockGenAILiveClient();
      
      // Simulate user input transcription
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'What is the weather like today?',
          isFinal: true
        });
      });

      // Stop recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      await user.click(stopButton);

      // 2. Verify user message is created
      await waitFor(() => {
        const userMessage = screen.getByTestId('user-message');
        expect(within(userMessage).getByText('What is the weather like today?')).toBeInTheDocument();
      });

      // 3. Simulate AI response
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'Today is sunny with a temperature of 25 degrees.',
          isFinal: true
        });
      });

      // 4. Verify assistant message is created
      await waitFor(() => {
        const assistantMessage = screen.getByTestId('assistant-message');
        expect(within(assistantMessage).getByText('Today is sunny with a temperature of 25 degrees.')).toBeInTheDocument();
      });

      // 5. Verify both messages are saved to storage
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms[0]?.messages).toHaveLength(2);
      
      const [userMsg, assistantMsg] = savedRooms[0].messages;
      expect(userMsg.type).toBe('user');
      expect(userMsg.content).toBe('What is the weather like today?');
      expect(assistantMsg.type).toBe('assistant');
      expect(assistantMsg.content).toBe('Today is sunny with a temperature of 25 degrees.');
    });

    it('should handle interruptions during AI response', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();
      
      // Start AI response
      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'I am responding to your',
          isFinal: false
        });
      });

      await waitFor(() => {
        expect(screen.getByText('I am responding to your')).toBeInTheDocument();
      });

      // Simulate interruption
      act(() => {
        mockClient.__testUtils.triggerEvent('interrupted');
      });

      await waitFor(() => {
        expect(screen.getByText(/interrupted/i)).toBeInTheDocument();
      });

      // User can start speaking again
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      expect(recordButton).toBeEnabled();
    });

    it('should handle multiple rapid conversations', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();

      // Simulate 3 rapid exchanges
      for (let i = 1; i <= 3; i++) {
        // User input
        const recordButton = screen.getByRole('button', { name: /start recording/i });
        await user.click(recordButton);

        act(() => {
          mockClient.__testUtils.triggerEvent('input_transcription', {
            text: `User question ${i}`,
            isFinal: true
          });
        });

        const stopButton = screen.getByRole('button', { name: /stop recording/i });
        await user.click(stopButton);

        await waitForAsync(100);

        // AI response
        act(() => {
          mockClient.__testUtils.triggerEvent('output_transcription', {
            text: `AI response ${i}`,
            isFinal: true
          });
        });

        await waitForAsync(100);
      }

      // Verify all messages are present
      await waitFor(() => {
        for (let i = 1; i <= 3; i++) {
          expect(screen.getByText(`User question ${i}`)).toBeInTheDocument();
          expect(screen.getByText(`AI response ${i}`)).toBeInTheDocument();
        }
      });

      // Verify all messages are saved
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms[0]?.messages).toHaveLength(6);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from network errors', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      // Simulate network error during transcription
      const mockClient = new MockGenAILiveClient();
      act(() => {
        mockClient.__testUtils.triggerEvent('error', new ErrorEvent('error', {
          message: 'Network connection lost'
        }));
      });

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should show recovery options
      const retryButton = screen.getByRole('button', { name: /reconnect/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });
    });

    it('should handle partial transcription loss', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      const mockClient = new MockGenAILiveClient();

      // Start transcription
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'This is the beginning',
          isFinal: false
        });
      });

      // Simulate transcription interruption
      act(() => {
        mockClient.__testUtils.triggerEvent('error', new ErrorEvent('error', {
          message: 'Transcription service temporarily unavailable'
        }));
      });

      await waitFor(() => {
        expect(screen.getByText(/transcription error/i)).toBeInTheDocument();
      });

      // User should be able to retry or manually input
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /type message/i })).toBeInTheDocument();
    });

    it('should maintain message integrity during errors', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      // Create a successful message first
      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();
      
      // Successful conversation
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'Hello AI',
          isFinal: true
        });
      });

      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      await user.click(stopButton);

      act(() => {
        mockClient.__testUtils.triggerEvent('output_transcription', {
          text: 'Hello human',
          isFinal: true
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Hello AI')).toBeInTheDocument();
        expect(screen.getByText('Hello human')).toBeInTheDocument();
      });

      // Now simulate error during second message
      await user.click(recordButton);

      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: 'Second message',
          isFinal: false
        });
      });

      // Error occurs
      act(() => {
        mockClient.__testUtils.triggerEvent('error', new ErrorEvent('error', {
          message: 'Service error'
        }));
      });

      await waitForAsync(1000);

      // First messages should still be intact
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello human')).toBeInTheDocument();

      // Partial second message should not be saved
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms[0]?.messages).toHaveLength(2);
      expect(savedRooms[0]?.messages.find(msg => msg.content === 'Second message')).toBeUndefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency transcription updates', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      const mockClient = new MockGenAILiveClient();
      const startTime = Date.now();

      // Simulate rapid updates (100 updates in quick succession)
      for (let i = 0; i < 100; i++) {
        act(() => {
          mockClient.__testUtils.triggerEvent('input_transcription', {
            text: `Word ${i} in the transcription`,
            isFinal: i === 99
          });
        });
      }

      const endTime = Date.now();

      // Should handle all updates without significant lag
      expect(endTime - startTime).toBeLessThan(1000);

      await waitFor(() => {
        expect(screen.getByText('Word 99 in the transcription')).toBeInTheDocument();
      });
    });

    it('should maintain responsiveness with long transcriptions', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const recordButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(recordButton);

      // Create very long transcription
      const longText = 'This is a very long sentence that keeps going and going. '.repeat(100);

      const mockClient = new MockGenAILiveClient();
      act(() => {
        mockClient.__testUtils.triggerEvent('input_transcription', {
          text: longText,
          isFinal: true
        });
      });

      // UI should remain responsive
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      const clickPromise = user.click(stopButton);

      // Click should resolve quickly even with long text
      await expect(clickPromise).resolves.toBeUndefined();

      await waitFor(() => {
        expect(screen.getByText(longText.substring(0, 50))).toBeInTheDocument();
      });
    });

    it('should efficiently manage memory with continuous usage', async () => {
      const { user } = renderWithProviders(<TranscriptionIntegrationTest />);

      const connectButton = await screen.findByRole('button', { name: /connect/i });
      await user.click(connectButton);

      const mockClient = new MockGenAILiveClient();

      // Simulate extended usage session
      for (let session = 0; session < 10; session++) {
        // Start recording
        const recordButton = screen.getByRole('button', { name: /start recording/i });
        await user.click(recordButton);

        // Multiple transcription updates
        for (let update = 0; update < 20; update++) {
          act(() => {
            mockClient.__testUtils.triggerEvent('input_transcription', {
              text: `Session ${session} update ${update}`,
              isFinal: update === 19
            });
          });
        }

        // Stop recording
        const stopButton = screen.getByRole('button', { name: /stop recording/i });
        await user.click(stopButton);

        // Add AI response
        act(() => {
          mockClient.__testUtils.triggerEvent('output_transcription', {
            text: `Response to session ${session}`,
            isFinal: true
          });
        });

        await waitForAsync(100);
      }

      // Should have all messages without memory issues
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms[0]?.messages).toHaveLength(20); // 10 user + 10 assistant

      // UI should still be responsive
      const finalRecordButton = screen.getByRole('button', { name: /start recording/i });
      expect(finalRecordButton).toBeEnabled();
    });
  });
});