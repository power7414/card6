/**
 * Unified Storage Service
 * 
 * This service provides a unified interface for storage operations with automatic
 * fallback from IndexedDB to localStorage and comprehensive error handling.
 */

import { ChatRoom, Message } from '../types/chat';
import { 
  chatRoomStorage, 
  messageStorage, 
  settingsStorage, 
  transcriptionStorage,
  dbManager,
  getStorageInfo
} from './indexeddb';

export interface StorageServiceOptions {
  enableIndexedDB?: boolean;
  enableLocalStorageFallback?: boolean;
  enableLogging?: boolean;
}

export interface StorageHealth {
  indexedDBAvailable: boolean;
  indexedDBConnected: boolean;
  localStorageAvailable: boolean;
  activeStorage: 'indexeddb' | 'localstorage' | 'memory';
  lastError?: string;
}

class StorageService {
  private options: Required<StorageServiceOptions>;
  private health: StorageHealth;
  private memoryFallback: Map<string, any> = new Map();

  constructor(options: StorageServiceOptions = {}) {
    this.options = {
      enableIndexedDB: true,
      enableLocalStorageFallback: true,
      enableLogging: true,
      ...options
    };

    this.health = {
      indexedDBAvailable: false,
      indexedDBConnected: false,
      localStorageAvailable: this.isLocalStorageAvailable(),
      activeStorage: 'memory'
    };

    this.initialize();
  }

  /**
   * Initialize the storage service
   */
  private async initialize(): Promise<void> {
    // Check IndexedDB availability
    if (this.options.enableIndexedDB) {
      try {
        this.health.indexedDBAvailable = dbManager.isIndexedDBSupported();
        if (this.health.indexedDBAvailable) {
          await dbManager.getDatabase();
          this.health.indexedDBConnected = true;
          this.health.activeStorage = 'indexeddb';
          this.log('IndexedDB initialized successfully');
        }
      } catch (error) {
        this.health.lastError = error instanceof Error ? error.message : 'IndexedDB initialization failed';
        this.log('IndexedDB initialization failed:', error);
      }
    }

    // Fall back to localStorage if IndexedDB is not available
    if (!this.health.indexedDBConnected && this.health.localStorageAvailable) {
      this.health.activeStorage = 'localstorage';
      this.log('Using localStorage fallback');
    }

    this.log('Storage service initialized with:', this.health.activeStorage);
  }

  /**
   * Get storage health information
   */
  async getHealth(): Promise<StorageHealth & { storageInfo?: any }> {
    const health = { ...this.health };
    
    if (this.health.indexedDBConnected) {
      try {
        const storageInfo = await getStorageInfo();
        return { ...health, storageInfo };
      } catch (error) {
        this.log('Failed to get storage info:', error);
      }
    }
    
    return health;
  }

  /**
   * Chat Room Operations
   */
  async getAllChatRooms(): Promise<ChatRoom[]> {
    return this.executeWithFallback(
      // IndexedDB
      async () => chatRoomStorage.getAllChatRooms(),
      // localStorage
      async () => {
        const data = localStorage.getItem('chatRooms');
        if (!data) return [];
        
        const parsed = JSON.parse(data);
        return parsed.map((room: any) => ({
          ...room,
          createdAt: new Date(room.createdAt),
          lastMessageAt: new Date(room.lastMessageAt),
          messages: room.messages?.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })) || []
        }));
      },
      // Memory fallback
      async () => {
        return this.memoryFallback.get('chatRooms') || [];
      }
    );
  }

  async saveChatRoom(chatRoom: ChatRoom): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => chatRoomStorage.saveChatRoom(chatRoom),
      // localStorage
      async () => {
        const rooms = await this.getAllChatRooms();
        const updatedRooms = rooms.filter(room => room.id !== chatRoom.id);
        updatedRooms.push(chatRoom);
        localStorage.setItem('chatRooms', JSON.stringify(updatedRooms));
      },
      // Memory fallback
      async () => {
        const rooms = this.memoryFallback.get('chatRooms') || [];
        const updatedRooms = rooms.filter((room: ChatRoom) => room.id !== chatRoom.id);
        updatedRooms.push(chatRoom);
        this.memoryFallback.set('chatRooms', updatedRooms);
      }
    );
  }

  async deleteChatRoom(id: string): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => chatRoomStorage.deleteChatRoom(id),
      // localStorage
      async () => {
        const rooms = await this.getAllChatRooms();
        const filteredRooms = rooms.filter(room => room.id !== id);
        localStorage.setItem('chatRooms', JSON.stringify(filteredRooms));
      },
      // Memory fallback
      async () => {
        const rooms = this.memoryFallback.get('chatRooms') || [];
        const filteredRooms = rooms.filter((room: ChatRoom) => room.id !== id);
        this.memoryFallback.set('chatRooms', filteredRooms);
      }
    );
  }

  async addMessage(chatRoomId: string, message: Message): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => messageStorage.addMessage(chatRoomId, message),
      // localStorage
      async () => {
        const rooms = await this.getAllChatRooms();
        const room = rooms.find(r => r.id === chatRoomId);
        if (room) {
          room.messages.push(message);
          room.lastMessageAt = new Date();
          await this.saveChatRoom(room);
        }
      },
      // Memory fallback
      async () => {
        const rooms = this.memoryFallback.get('chatRooms') || [];
        const room = rooms.find((r: ChatRoom) => r.id === chatRoomId);
        if (room) {
          room.messages.push(message);
          room.lastMessageAt = new Date();
          this.memoryFallback.set('chatRooms', rooms);
        }
      }
    );
  }

  async updateMessage(chatRoomId: string, message: Message): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => messageStorage.updateMessage(chatRoomId, message),
      // localStorage
      async () => {
        const rooms = await this.getAllChatRooms();
        const room = rooms.find(r => r.id === chatRoomId);
        if (room) {
          const messageIndex = room.messages.findIndex((m: Message) => m.id === message.id);
          if (messageIndex !== -1) {
            room.messages[messageIndex] = message;
            room.lastMessageAt = new Date();
            await this.saveChatRoom(room);
          }
        }
      },
      // Memory fallback
      async () => {
        const rooms = this.memoryFallback.get('chatRooms') || [];
        const room = rooms.find((r: ChatRoom) => r.id === chatRoomId);
        if (room) {
          const messageIndex = room.messages.findIndex((m: Message) => m.id === message.id);
          if (messageIndex !== -1) {
            room.messages[messageIndex] = message;
            room.lastMessageAt = new Date();
            this.memoryFallback.set('chatRooms', rooms);
          }
        }
      }
    );
  }

  /**
   * Settings Operations
   */
  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return this.executeWithFallback(
      // IndexedDB
      async () => settingsStorage.getSetting(key, defaultValue),
      // localStorage
      async () => {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        
        try {
          return JSON.parse(value);
        } catch {
          return value as any;
        }
      },
      // Memory fallback
      async () => {
        return this.memoryFallback.get(`setting_${key}`) ?? defaultValue;
      }
    );
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => settingsStorage.setSetting(key, value),
      // localStorage
      async () => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      // Memory fallback
      async () => {
        this.memoryFallback.set(`setting_${key}`, value);
      }
    );
  }

  async deleteSetting(key: string): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => settingsStorage.deleteSetting(key),
      // localStorage
      async () => {
        localStorage.removeItem(key);
      },
      // Memory fallback
      async () => {
        this.memoryFallback.delete(`setting_${key}`);
      }
    );
  }

  /**
   * Transcription Operations
   */
  async saveTranscription(transcription: {
    id: string;
    chatRoomId: string;
    content: string;
    isActive: boolean;
    isFinal: boolean;
  }): Promise<void> {
    return this.executeWithFallback(
      // IndexedDB
      async () => transcriptionStorage.saveTranscription(transcription),
      // localStorage
      async () => {
        const key = `transcription_${transcription.chatRoomId}`;
        const existing = localStorage.getItem(key);
        const transcriptions = existing ? JSON.parse(existing) : [];
        
        const index = transcriptions.findIndex((t: any) => t.id === transcription.id);
        if (index !== -1) {
          transcriptions[index] = { ...transcription, timestamp: new Date() };
        } else {
          transcriptions.push({ ...transcription, timestamp: new Date() });
        }
        
        localStorage.setItem(key, JSON.stringify(transcriptions));
      },
      // Memory fallback
      async () => {
        const key = `transcription_${transcription.chatRoomId}`;
        const existing = this.memoryFallback.get(key) || [];
        
        const index = existing.findIndex((t: any) => t.id === transcription.id);
        if (index !== -1) {
          existing[index] = { ...transcription, timestamp: new Date() };
        } else {
          existing.push({ ...transcription, timestamp: new Date() });
        }
        
        this.memoryFallback.set(key, existing);
      }
    );
  }

  async getTranscriptions(chatRoomId: string): Promise<any[]> {
    return this.executeWithFallback(
      // IndexedDB
      async () => transcriptionStorage.getTranscriptions(chatRoomId),
      // localStorage
      async () => {
        const key = `transcription_${chatRoomId}`;
        const data = localStorage.getItem(key);
        if (!data) return [];
        
        const transcriptions = JSON.parse(data);
        return transcriptions.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }));
      },
      // Memory fallback
      async () => {
        const key = `transcription_${chatRoomId}`;
        return this.memoryFallback.get(key) || [];
      }
    );
  }

  /**
   * Execute operation with fallback chain
   */
  private async executeWithFallback<T>(
    indexedDBOperation: () => Promise<T>,
    localStorageOperation: () => Promise<T>,
    memoryOperation: () => Promise<T>
  ): Promise<T> {
    // Try IndexedDB first if available
    if (this.health.indexedDBConnected) {
      try {
        return await indexedDBOperation();
      } catch (error) {
        this.log('IndexedDB operation failed, falling back:', error);
        this.health.lastError = error instanceof Error ? error.message : 'IndexedDB operation failed';
        
        // Mark IndexedDB as disconnected and switch to fallback
        this.health.indexedDBConnected = false;
        this.health.activeStorage = this.health.localStorageAvailable ? 'localstorage' : 'memory';
      }
    }

    // Try localStorage if available
    if (this.health.localStorageAvailable && this.options.enableLocalStorageFallback) {
      try {
        return await localStorageOperation();
      } catch (error) {
        this.log('localStorage operation failed, falling back to memory:', error);
        this.health.lastError = error instanceof Error ? error.message : 'localStorage operation failed';
        this.health.localStorageAvailable = false;
        this.health.activeStorage = 'memory';
      }
    }

    // Final fallback to memory
    try {
      return await memoryOperation();
    } catch (error) {
      this.log('All storage operations failed:', error);
      throw new Error(`All storage operations failed: ${error}`);
    }
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logging utility
   */
  private log(...args: any[]): void {
    if (this.options.enableLogging) {
      console.log('[StorageService]', ...args);
    }
  }

  /**
   * Clear all data (for testing/reset purposes)
   */
  async clearAllData(): Promise<void> {
    try {
      // Clear IndexedDB
      if (this.health.indexedDBAvailable) {
        await dbManager.deleteDatabase();
      }
      
      // Clear localStorage
      if (this.health.localStorageAvailable) {
        localStorage.clear();
      }
      
      // Clear memory
      this.memoryFallback.clear();
      
      this.log('All data cleared');
    } catch (error) {
      this.log('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Export data for backup purposes
   */
  async exportData(): Promise<{
    chatRooms: ChatRoom[];
    settings: Record<string, any>;
    transcriptions: Record<string, any[]>;
    exportedAt: string;
  }> {
    const chatRooms = await this.getAllChatRooms();
    
    // Get all settings
    const settings: Record<string, any> = {};
    if (this.health.indexedDBConnected) {
      const allSettings = await settingsStorage.getAllSettings();
      Object.assign(settings, allSettings);
    } else if (this.health.localStorageAvailable) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('transcription_') && key !== 'chatRooms') {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              settings[key] = JSON.parse(value);
            } catch {
              settings[key] = value;
            }
          }
        }
      }
    }

    // Get all transcriptions
    const transcriptions: Record<string, any[]> = {};
    for (const room of chatRooms) {
      transcriptions[room.id] = await this.getTranscriptions(room.id);
    }

    return {
      chatRooms,
      settings,
      transcriptions,
      exportedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;