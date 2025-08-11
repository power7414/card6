/**
 * Type-safe Storage API for IndexedDB
 * 
 * This file provides high-level, type-safe APIs for storing and retrieving
 * different types of data in IndexedDB with automatic fallback to localStorage.
 */

import { ChatRoom, Message } from '../../types/chat';
import { dbManager, requestToPromise, cursorToArray, DatabaseError } from './database';
import { STORES, INDEXES, STORAGE_KEYS } from './schema';

export interface StorageOptions {
  useLocalStorageFallback?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

const DEFAULT_OPTIONS: Required<StorageOptions> = {
  useLocalStorageFallback: true,
  retryAttempts: 3,
  retryDelay: 1000
};

/**
 * Base Storage API with common operations
 */
abstract class BaseStorageAPI {
  protected options: Required<StorageOptions>;

  constructor(options: StorageOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute operation with retry logic and fallback
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Storage operation failed (attempt ${attempt + 1}):`, error);
        
        if (attempt < this.options.retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        }
      }
    }

    // If IndexedDB fails and fallback is available, use it
    if (this.options.useLocalStorageFallback && fallback) {
      try {
        console.info('Using localStorage fallback');
        return await fallback();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }

    throw new DatabaseError(
      `Operation failed after ${this.options.retryAttempts} attempts`,
      lastError || undefined
    );
  }

  /**
   * Check if IndexedDB is available
   */
  protected isIndexedDBAvailable(): boolean {
    return dbManager.isIndexedDBSupported();
  }
}

/**
 * Chat Room Storage API
 */
export class ChatRoomStorageAPI extends BaseStorageAPI {
  private readonly STORAGE_KEY = 'chatRooms';

  async getAllChatRooms(): Promise<ChatRoom[]> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.CHAT_ROOMS, STORES.MESSAGES], async (stores) => {
          const chatRoomsData = await cursorToArray<any>(stores[STORES.CHAT_ROOMS].openCursor());
          
          // Load messages for each chat room
          const chatRooms: ChatRoom[] = [];
          for (const roomData of chatRoomsData) {
            const messagesRequest = stores[STORES.MESSAGES].index(INDEXES.MESSAGES.BY_CHAT_ROOM_ID).getAll(roomData.id);
            const messages = await requestToPromise(messagesRequest);
            
            chatRooms.push({
              ...roomData,
              messages: messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            });
          }
          
          return chatRooms.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
        });
      },
      async () => {
        const data = localStorage.getItem(this.STORAGE_KEY);
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
      }
    );
  }

  async getChatRoom(id: string): Promise<ChatRoom | null> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.CHAT_ROOMS, STORES.MESSAGES], async (stores) => {
          const roomRequest = stores[STORES.CHAT_ROOMS].get(id);
          const roomData = await requestToPromise(roomRequest);
          
          if (!roomData) return null;
          
          const messagesRequest = stores[STORES.MESSAGES].index(INDEXES.MESSAGES.BY_CHAT_ROOM_ID).getAll(id);
          const messages = await requestToPromise(messagesRequest);
          
          return {
            ...roomData,
            messages: messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          };
        });
      },
      async () => {
        const rooms = await this.getAllChatRooms();
        return rooms.find(room => room.id === id) || null;
      }
    );
  }

  async saveChatRoom(chatRoom: ChatRoom): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.CHAT_ROOMS, STORES.MESSAGES], async (stores) => {
          // Separate room data from messages
          const { messages, ...roomData } = chatRoom;
          
          // Save room data
          await requestToPromise(stores[STORES.CHAT_ROOMS].put(roomData));
          
          // Save messages separately
          for (const message of messages) {
            await requestToPromise(stores[STORES.MESSAGES].put({
              ...message,
              chatRoomId: chatRoom.id
            }));
          }
        });
      },
      async () => {
        const rooms = await this.getAllChatRooms();
        const updatedRooms = rooms.filter(room => room.id !== chatRoom.id);
        updatedRooms.push(chatRoom);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedRooms));
      }
    );
  }

  async deleteChatRoom(id: string): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.CHAT_ROOMS, STORES.MESSAGES], async (stores) => {
          // Delete room
          await requestToPromise(stores[STORES.CHAT_ROOMS].delete(id));
          
          // Delete all messages for this room
          const messagesIndex = stores[STORES.MESSAGES].index(INDEXES.MESSAGES.BY_CHAT_ROOM_ID);
          const messagesCursor = messagesIndex.openCursor(id);
          
          return new Promise<void>((resolve, reject) => {
            messagesCursor.onsuccess = () => {
              const cursor = messagesCursor.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                resolve();
              }
            };
            messagesCursor.onerror = () => reject(messagesCursor.error);
          });
        });
      },
      async () => {
        const rooms = await this.getAllChatRooms();
        const filteredRooms = rooms.filter(room => room.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredRooms));
      }
    );
  }

  async updateChatRoom(id: string, updates: Partial<ChatRoom>): Promise<void> {
    const room = await this.getChatRoom(id);
    if (!room) {
      throw new Error(`Chat room with id ${id} not found`);
    }

    const updatedRoom = { ...room, ...updates };
    await this.saveChatRoom(updatedRoom);
  }
}

/**
 * Message Storage API
 */
export class MessageStorageAPI extends BaseStorageAPI {
  async addMessage(chatRoomId: string, message: Message): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.MESSAGES], async (stores) => {
          await requestToPromise(stores[STORES.MESSAGES].put({
            ...message,
            chatRoomId
          }));
        });
      },
      async () => {
        // For localStorage fallback, we need to update the chat room
        const chatRoomAPI = new ChatRoomStorageAPI(this.options);
        const room = await chatRoomAPI.getChatRoom(chatRoomId);
        if (room) {
          room.messages.push(message);
          room.lastMessageAt = new Date();
          await chatRoomAPI.saveChatRoom(room);
        }
      }
    );
  }

  async updateMessage(chatRoomId: string, message: Message): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.MESSAGES], async (stores) => {
          await requestToPromise(stores[STORES.MESSAGES].put({
            ...message,
            chatRoomId
          }));
        });
      },
      async () => {
        // For localStorage fallback, we need to update the chat room
        const chatRoomAPI = new ChatRoomStorageAPI(this.options);
        const room = await chatRoomAPI.getChatRoom(chatRoomId);
        if (room) {
          const messageIndex = room.messages.findIndex((m: Message) => m.id === message.id);
          if (messageIndex !== -1) {
            room.messages[messageIndex] = message;
            room.lastMessageAt = new Date();
            await chatRoomAPI.saveChatRoom(room);
          }
        }
      }
    );
  }

  async getMessages(chatRoomId: string, limit?: number, offset?: number): Promise<Message[]> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.MESSAGES], async (stores) => {
          const index = stores[STORES.MESSAGES].index(INDEXES.MESSAGES.BY_CHAT_ROOM_ID);
          const request = index.getAll(chatRoomId);
          const messages = await requestToPromise(request);
          
          // Sort by timestamp
          const sortedMessages = messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          // Apply pagination if specified
          if (offset !== undefined || limit !== undefined) {
            const start = offset || 0;
            const end = limit ? start + limit : undefined;
            return sortedMessages.slice(start, end);
          }
          
          return sortedMessages;
        });
      },
      async () => {
        const chatRoomAPI = new ChatRoomStorageAPI(this.options);
        const room = await chatRoomAPI.getChatRoom(chatRoomId);
        if (!room) return [];
        
        let messages = room.messages;
        if (offset !== undefined || limit !== undefined) {
          const start = offset || 0;
          const end = limit ? start + limit : undefined;
          messages = messages.slice(start, end);
        }
        
        return messages;
      }
    );
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.MESSAGES], async (stores) => {
          await requestToPromise(stores[STORES.MESSAGES].delete(messageId));
        });
      },
      async () => {
        // For localStorage, we need to find and update the containing chat room
        const chatRoomAPI = new ChatRoomStorageAPI(this.options);
        const rooms = await chatRoomAPI.getAllChatRooms();
        
        for (const room of rooms) {
          const messageIndex = room.messages.findIndex(msg => msg.id === messageId);
          if (messageIndex !== -1) {
            room.messages.splice(messageIndex, 1);
            await chatRoomAPI.saveChatRoom(room);
            break;
          }
        }
      }
    );
  }
}

/**
 * Settings Storage API
 */
export class SettingsStorageAPI extends BaseStorageAPI {
  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.SETTINGS], async (stores) => {
          const request = stores[STORES.SETTINGS].get(key);
          const result = await requestToPromise(request);
          return result ? result.value : defaultValue;
        });
      },
      async () => {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        
        try {
          return JSON.parse(value);
        } catch {
          return value as any;
        }
      }
    );
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.SETTINGS], async (stores) => {
          await requestToPromise(stores[STORES.SETTINGS].put({
            key,
            value,
            timestamp: new Date(),
            version: 1
          }));
        });
      },
      async () => {
        localStorage.setItem(key, JSON.stringify(value));
      }
    );
  }

  async deleteSetting(key: string): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.SETTINGS], async (stores) => {
          await requestToPromise(stores[STORES.SETTINGS].delete(key));
        });
      },
      async () => {
        localStorage.removeItem(key);
      }
    );
  }

  async getAllSettings(): Promise<Record<string, any>> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.SETTINGS], async (stores) => {
          const settings = await cursorToArray<any>(stores[STORES.SETTINGS].openCursor());
          const result: Record<string, any> = {};
          
          settings.forEach(setting => {
            result[setting.key] = setting.value;
          });
          
          return result;
        });
      },
      async () => {
        const result: Record<string, any> = {};
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            if (value) {
              try {
                result[key] = JSON.parse(value);
              } catch {
                result[key] = value;
              }
            }
          }
        }
        
        return result;
      }
    );
  }
}

/**
 * Transcription Storage API
 */
export class TranscriptionStorageAPI extends BaseStorageAPI {
  async saveTranscription(transcription: {
    id: string;
    chatRoomId: string;
    content: string;
    isActive: boolean;
    isFinal: boolean;
  }): Promise<void> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withWriteTransaction([STORES.TRANSCRIPTIONS], async (stores) => {
          await requestToPromise(stores[STORES.TRANSCRIPTIONS].put({
            ...transcription,
            timestamp: new Date()
          }));
        });
      },
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
      }
    );
  }

  async getTranscriptions(chatRoomId: string): Promise<any[]> {
    return this.executeWithRetry(
      async () => {
        return dbManager.withReadTransaction([STORES.TRANSCRIPTIONS], async (stores) => {
          const index = stores[STORES.TRANSCRIPTIONS].index(INDEXES.TRANSCRIPTIONS.BY_CHAT_ROOM_ID);
          const request = index.getAll(chatRoomId);
          const transcriptions = await requestToPromise(request);
          
          return transcriptions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      },
      async () => {
        const key = `transcription_${chatRoomId}`;
        const data = localStorage.getItem(key);
        if (!data) return [];
        
        const transcriptions = JSON.parse(data);
        return transcriptions.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }));
      }
    );
  }
}

// Export singleton instances
export const chatRoomStorage = new ChatRoomStorageAPI();
export const messageStorage = new MessageStorageAPI();
export const settingsStorage = new SettingsStorageAPI();
export const transcriptionStorage = new TranscriptionStorageAPI();