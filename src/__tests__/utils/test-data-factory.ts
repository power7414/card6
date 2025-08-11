/**
 * Test Data Factory
 * 
 * Provides utilities for creating mock data objects used throughout tests.
 * Includes factories for ChatRooms, Messages, Users, and other domain objects.
 */

import { ChatRoom, Message } from '../../types/chat';
import { TranscriptionSegment, TranscriptionState } from '../../types/transcription';

export interface MockDataOptions {
  id?: string;
  timestamp?: Date;
  overrides?: Partial<any>;
}

export class TestDataFactory {
  private static idCounter = 0;

  /**
   * Generate unique test ID
   */
  static generateId(prefix = 'test'): string {
    return `${prefix}_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Create mock ChatRoom
   */
  static createMockChatRoom(options: MockDataOptions & {
    name?: string;
    messageCount?: number;
    isActive?: boolean;
  } = {}): ChatRoom {
    const {
      id = this.generateId('chatroom'),
      timestamp = new Date(),
      name = `測試對話 ${this.idCounter}`,
      messageCount = 0,
      isActive = false,
      overrides = {}
    } = options;

    const messages: Message[] = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push(this.createMockMessage({
        overrides: { 
          type: i % 2 === 0 ? 'user' : 'assistant',
          content: `Test message ${i + 1}`
        }
      }));
    }

    return {
      id,
      name,
      createdAt: timestamp,
      lastMessageAt: timestamp,
      messages,
      isActive,
      ...overrides
    };
  }

  /**
   * Create mock Message
   */
  static createMockMessage(options: MockDataOptions & {
    type?: 'user' | 'assistant';
    content?: string;
    audioUrl?: string;
    hasTranscription?: boolean;
  } = {}): Message {
    const {
      id = this.generateId('message'),
      timestamp = new Date(),
      type = 'user',
      content = 'Test message content',
      audioUrl,
      hasTranscription = false,
      overrides = {}
    } = options;

    const message: Message = {
      id,
      type,
      content,
      timestamp,
      ...overrides
    };

    if (audioUrl) {
      message.audioUrl = audioUrl;
    }

    if (hasTranscription) {
      message.isTranscribing = false;
      message.transcription = content;
      message.realtimeTranscription = {
        currentText: content,
        isFinal: true,
        isProcessing: false
      };
    }

    return message;
  }

  /**
   * Create mock TranscriptionSegment
   */
  static createMockTranscriptionSegment(options: MockDataOptions & {
    text?: string;
    isFinal?: boolean;
    confidence?: number;
  } = {}): TranscriptionSegment {
    const {
      id = this.generateId('segment'),
      timestamp = new Date(),
      text = 'Test transcription text',
      isFinal = false,
      confidence = 0.95,
      overrides = {}
    } = options;

    return {
      id,
      text,
      isFinal,
      confidence,
      timestamp,
      ...overrides
    };
  }

  /**
   * Create mock TranscriptionState
   */
  static createMockTranscriptionState(options: {
    currentTranscript?: string;
    isTranscribing?: boolean;
    status?: 'idle' | 'recording' | 'processing' | 'complete' | 'error';
    error?: string;
  } = {}): TranscriptionState {
    const {
      currentTranscript = '',
      isTranscribing = false,
      status = 'idle',
      error
    } = options;

    const state: TranscriptionState = {
      currentTranscript,
      isTranscribing,
      status
    };

    if (error) {
      state.error = error;
    }

    return state;
  }

  /**
   * Create multiple mock ChatRooms
   */
  static createMockChatRooms(count: number, options: MockDataOptions = {}): ChatRoom[] {
    const rooms: ChatRoom[] = [];
    
    for (let i = 0; i < count; i++) {
      rooms.push(this.createMockChatRoom({
        ...options,
        name: `測試對話 ${i + 1}`,
        messageCount: Math.floor(Math.random() * 10),
        isActive: i === 0 // First room is active
      }));
    }

    return rooms;
  }

  /**
   * Create conversation flow (alternating user/assistant messages)
   */
  static createMockConversation(messageCount: number): Message[] {
    const messages: Message[] = [];
    
    for (let i = 0; i < messageCount; i++) {
      const isUser = i % 2 === 0;
      messages.push(this.createMockMessage({
        type: isUser ? 'user' : 'assistant',
        content: isUser 
          ? `User message ${Math.floor(i / 2) + 1}` 
          : `Assistant response ${Math.floor(i / 2) + 1}`,
        hasTranscription: true,
        timestamp: new Date(Date.now() + i * 1000) // 1 second apart
      }));
    }

    return messages;
  }

  /**
   * Create mock audio blob
   */
  static createMockAudioBlob(duration: number = 1000): Blob {
    // Create mock audio data
    const buffer = new ArrayBuffer(duration * 44.1); // Simulate 44.1kHz sample rate
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Create mock MediaStream
   */
  static createMockMediaStream(): MediaStream {
    const stream = {
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
          getSettings: jest.fn(() => ({
            sampleRate: 44100,
            channelCount: 1
          })),
          enabled: true,
          id: this.generateId('track'),
          kind: 'audio',
          label: 'Mock Microphone',
          muted: false,
          readyState: 'live',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }
      ]),
      getAudioTracks: jest.fn(() => stream.getTracks()),
      getVideoTracks: jest.fn(() => []),
      active: true,
      id: this.generateId('stream'),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as unknown as MediaStream;

    return stream;
  }

  /**
   * Create mock storage settings
   */
  static createMockStorageSettings(): Record<string, any> {
    return {
      activeChatRoom: 'chatroom_1',
      currentTranscript: '',
      isRecording: false,
      audioSettings: {
        inputDeviceId: 'default',
        outputDeviceId: 'default',
        autoGainControl: true,
        noiseSuppression: true
      },
      uiSettings: {
        theme: 'light',
        fontSize: 'medium',
        showTimestamps: true
      }
    };
  }

  /**
   * Create mock Live API config
   */
  static createMockLiveAPIConfig(): any {
    return {
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: ['AUDIO', 'TEXT'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        }
      },
      systemInstruction: {
        parts: [
          {
            text: 'You are a helpful AI assistant for voice conversations.'
          }
        ]
      }
    };
  }

  /**
   * Reset ID counter (useful for consistent test data)
   */
  static resetIdCounter(): void {
    this.idCounter = 0;
  }

  /**
   * Create bulk test data for performance testing
   */
  static createBulkTestData(roomCount: number = 100, messagesPerRoom: number = 50): {
    rooms: ChatRoom[];
    totalMessages: number;
  } {
    const rooms: ChatRoom[] = [];
    let totalMessages = 0;

    for (let i = 0; i < roomCount; i++) {
      const room = this.createMockChatRoom({
        name: `Performance Test Room ${i + 1}`,
        messageCount: messagesPerRoom
      });
      rooms.push(room);
      totalMessages += messagesPerRoom;
    }

    return { rooms, totalMessages };
  }
}

// Convenience exports
export const createMockChatRoom = TestDataFactory.createMockChatRoom.bind(TestDataFactory);
export const createMockMessage = TestDataFactory.createMockMessage.bind(TestDataFactory);
export const createMockConversation = TestDataFactory.createMockConversation.bind(TestDataFactory);
export const createMockChatRooms = TestDataFactory.createMockChatRooms.bind(TestDataFactory);