/**
 * Enhanced IndexedDB Mock Service
 * 
 * Provides comprehensive mocking for IndexedDB operations with realistic
 * behavior, error simulation, and test utilities.
 */

import { ChatRoom, Message } from '../types/chat';

export interface MockIndexedDBOptions {
  simulateErrors?: boolean;
  errorRate?: number;
  simulateLatency?: boolean;
  latencyRange?: [number, number];
}

export class MockIndexedDBService {
  private data: Map<string, any> = new Map();
  private options: MockIndexedDBOptions;
  private isInitialized = false;

  constructor(options: MockIndexedDBOptions = {}) {
    this.options = {
      simulateErrors: false,
      errorRate: 0.1,
      simulateLatency: true,
      latencyRange: [10, 100],
      ...options
    };
  }

  async initialize(): Promise<void> {
    await this.delay();
    
    if (this.shouldSimulateError()) {
      throw new Error('Mock IndexedDB initialization failed');
    }
    
    this.isInitialized = true;
  }

  async getAllChatRooms(): Promise<ChatRoom[]> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error('Failed to retrieve chat rooms');
    }
    
    const rooms = Array.from(this.data.values())
      .filter(item => item.type === 'chatroom')
      .map(item => ({
        ...item.data,
        createdAt: new Date(item.data.createdAt),
        lastMessageAt: new Date(item.data.lastMessageAt),
        messages: item.data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    
    return rooms.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getChatRoom(id: string): Promise<ChatRoom | null> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to retrieve chat room ${id}`);
    }
    
    const key = `chatroom_${id}`;
    const item = this.data.get(key);
    
    if (!item || item.type !== 'chatroom') {
      return null;
    }
    
    return {
      ...item.data,
      createdAt: new Date(item.data.createdAt),
      lastMessageAt: new Date(item.data.lastMessageAt),
      messages: item.data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  async saveChatRoom(chatRoom: ChatRoom): Promise<void> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to save chat room ${chatRoom.id}`);
    }
    
    const key = `chatroom_${chatRoom.id}`;
    this.data.set(key, {
      type: 'chatroom',
      data: {
        ...chatRoom,
        createdAt: chatRoom.createdAt.toISOString(),
        lastMessageAt: chatRoom.lastMessageAt.toISOString(),
        messages: chatRoom.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        }))
      }
    });
  }

  async deleteChatRoom(id: string): Promise<void> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to delete chat room ${id}`);
    }
    
    const key = `chatroom_${id}`;
    this.data.delete(key);
    
    // Also delete associated messages and transcriptions
    const keysToDelete: string[] = [];
    this.data.forEach((value, key) => {
      if (key.startsWith(`message_${id}_`) || key.startsWith(`transcription_${id}_`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.data.delete(key));
  }

  async addMessage(chatRoomId: string, message: Message): Promise<void> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to add message to chat room ${chatRoomId}`);
    }
    
    // Update the chat room's messages
    const chatRoom = await this.getChatRoom(chatRoomId);
    if (chatRoom) {
      chatRoom.messages.push(message);
      chatRoom.lastMessageAt = new Date();
      await this.saveChatRoom(chatRoom);
    }
  }

  async getMessages(chatRoomId: string, limit?: number, offset?: number): Promise<Message[]> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to retrieve messages for chat room ${chatRoomId}`);
    }
    
    const chatRoom = await this.getChatRoom(chatRoomId);
    if (!chatRoom) {
      return [];
    }
    
    let messages = chatRoom.messages;
    
    if (offset !== undefined || limit !== undefined) {
      const start = offset || 0;
      const end = limit ? start + limit : undefined;
      messages = messages.slice(start, end);
    }
    
    return messages;
  }

  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to retrieve setting ${key}`);
    }
    
    const settingKey = `setting_${key}`;
    const item = this.data.get(settingKey);
    
    return item ? item.value : defaultValue;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to save setting ${key}`);
    }
    
    const settingKey = `setting_${key}`;
    this.data.set(settingKey, {
      type: 'setting',
      key,
      value,
      timestamp: new Date().toISOString()
    });
  }

  async saveTranscription(transcription: {
    id: string;
    chatRoomId: string;
    content: string;
    isActive: boolean;
    isFinal: boolean;
  }): Promise<void> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to save transcription ${transcription.id}`);
    }
    
    const key = `transcription_${transcription.chatRoomId}_${transcription.id}`;
    this.data.set(key, {
      type: 'transcription',
      data: {
        ...transcription,
        timestamp: new Date().toISOString()
      }
    });
  }

  async getTranscriptions(chatRoomId: string): Promise<any[]> {
    await this.delay();
    this.ensureInitialized();
    
    if (this.shouldSimulateError()) {
      throw new Error(`Failed to retrieve transcriptions for chat room ${chatRoomId}`);
    }
    
    const transcriptions: any[] = [];
    this.data.forEach((value, key) => {
      if (key.startsWith(`transcription_${chatRoomId}_`) && value.type === 'transcription') {
        transcriptions.push({
          ...value.data,
          timestamp: new Date(value.data.timestamp)
        });
      }
    });
    
    return transcriptions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Test utilities
  public __testUtils = {
    clear: () => {
      this.data.clear();
      this.isInitialized = false;
    },
    
    setData: (key: string, value: any) => {
      this.data.set(key, value);
    },
    
    getData: (key: string) => {
      return this.data.get(key);
    },
    
    getAllData: () => {
      return Object.fromEntries(this.data);
    },
    
    getDataSize: () => {
      return this.data.size;
    },
    
    simulateError: (shouldError: boolean = true) => {
      this.options.simulateErrors = shouldError;
      this.options.errorRate = shouldError ? 1 : 0;
    },
    
    setInitialized: (initialized: boolean) => {
      this.isInitialized = initialized;
    }
  };

  private async delay(): Promise<void> {
    if (!this.options.simulateLatency) return;
    
    const [min, max] = this.options.latencyRange!;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private shouldSimulateError(): boolean {
    return !!(this.options.simulateErrors && Math.random() < (this.options.errorRate ?? 0.1));
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('MockIndexedDBService not initialized');
    }
  }
}

// Export singleton instance for tests
export const mockIndexedDB = new MockIndexedDBService();