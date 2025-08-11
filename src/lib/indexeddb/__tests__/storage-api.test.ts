/**
 * Unit tests for Storage API
 * 
 * Tests comprehensive storage operations including:
 * - ChatRoom CRUD operations
 * - Message management
 * - Settings storage
 * - Transcription storage
 * - Error handling and fallback mechanisms
 * - Performance and concurrency
 */

import {
  ChatRoomStorageAPI,
  MessageStorageAPI,
  SettingsStorageAPI,
  TranscriptionStorageAPI
} from '../storage-api';
import { TestDataFactory } from '../../../__tests__/utils/test-data-factory';
import { MockIndexedDBService } from '../../../__mocks__/indexeddb-mock';

// Mock the database manager
jest.mock('../database', () => ({
  dbManager: {
    isIndexedDBSupported: jest.fn(() => true),
    withReadTransaction: jest.fn(),
    withWriteTransaction: jest.fn()
  },
  requestToPromise: jest.fn(),
  cursorToArray: jest.fn(),
  DatabaseError: class extends Error {
    constructor(message: string, cause?: Error) {
      super(message);
      this.cause = cause;
    }
  }
}));

describe('Storage API', () => {
  let mockIndexedDB: MockIndexedDBService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexedDB = new MockIndexedDBService();
    mockIndexedDB.__testUtils.clear();
  });

  describe('ChatRoomStorageAPI', () => {
    let api: ChatRoomStorageAPI;

    beforeEach(() => {
      api = new ChatRoomStorageAPI();
    });

    describe('getAllChatRooms', () => {
      it('should retrieve all chat rooms with messages', async () => {
        const mockRooms = TestDataFactory.createMockChatRooms(3);
        
        // Mock the database implementation
        const { dbManager } = require('../database');
        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              openCursor: () => ({
                result: null // Simulate empty cursor for simplicity
              })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: [] })
              })
            }
          });
        });

        // Mock localStorage fallback
        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => JSON.stringify(mockRooms.map(room => ({
            ...room,
            createdAt: room.createdAt.toISOString(),
            lastMessageAt: room.lastMessageAt.toISOString(),
            messages: room.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            }))
          }))))
        });

        const result = await api.getAllChatRooms();

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          createdAt: expect.any(Date),
          lastMessageAt: expect.any(Date),
          messages: expect.any(Array)
        });
      });

      it('should handle empty database', async () => {
        const { dbManager } = require('../database');
        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              openCursor: () => ({ result: null })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: [] })
              })
            }
          });
        });

        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => null)
        });

        const result = await api.getAllChatRooms();

        expect(result).toEqual([]);
      });

      it('should fall back to localStorage when IndexedDB fails', async () => {
        const mockRooms = TestDataFactory.createMockChatRooms(2);
        const { dbManager } = require('../database');
        
        // Simulate IndexedDB failure
        dbManager.withReadTransaction.mockRejectedValue(new Error('IndexedDB error'));

        // Mock localStorage fallback
        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => JSON.stringify(mockRooms.map(room => ({
            ...room,
            createdAt: room.createdAt.toISOString(),
            lastMessageAt: room.lastMessageAt.toISOString(),
            messages: room.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            }))
          }))))
        });

        const result = await api.getAllChatRooms();

        expect(result).toHaveLength(2);
        expect(result[0].createdAt).toBeInstanceOf(Date);
      });

      it('should sort rooms by lastMessageAt in descending order', async () => {
        const oldRoom = TestDataFactory.createMockChatRoom({
          timestamp: new Date('2024-01-01')
        });
        const newRoom = TestDataFactory.createMockChatRoom({
          timestamp: new Date('2024-01-02')
        });

        const { dbManager } = require('../database');
        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              openCursor: () => ({ result: null })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: [] })
              })
            }
          });
        });

        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => JSON.stringify([oldRoom, newRoom].map(room => ({
            ...room,
            createdAt: room.createdAt.toISOString(),
            lastMessageAt: room.lastMessageAt.toISOString(),
            messages: room.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            }))
          }))))
        });

        const result = await api.getAllChatRooms();

        expect(result[0].lastMessageAt.getTime()).toBeGreaterThan(
          result[1].lastMessageAt.getTime()
        );
      });
    });

    describe('getChatRoom', () => {
      it('should retrieve specific chat room by ID', async () => {
        const mockRoom = TestDataFactory.createMockChatRoom();
        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              get: () => ({ result: mockRoom })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: mockRoom.messages })
              })
            }
          });
        });

        requestToPromise.mockResolvedValueOnce(mockRoom);
        requestToPromise.mockResolvedValueOnce(mockRoom.messages);

        const result = await api.getChatRoom(mockRoom.id);

        expect(result).toMatchObject({
          id: mockRoom.id,
          name: mockRoom.name,
          messages: expect.any(Array)
        });
      });

      it('should return null for non-existent chat room', async () => {
        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              get: () => ({ result: null })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: [] })
              })
            }
          });
        });

        requestToPromise.mockResolvedValueOnce(null);

        const result = await api.getChatRoom('non-existent-id');

        expect(result).toBeNull();
      });
    });

    describe('saveChatRoom', () => {
      it('should save chat room and its messages', async () => {
        const mockRoom = TestDataFactory.createMockChatRoom({
          messageCount: 3
        });

        const { dbManager, requestToPromise } = require('../database');
        const mockPut = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: { put: mockPut },
            messages: { put: mockPut }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.saveChatRoom(mockRoom);

        // Should save room data and each message
        expect(mockPut).toHaveBeenCalledTimes(1 + mockRoom.messages.length);
      });

      it('should handle save errors with fallback', async () => {
        const mockRoom = TestDataFactory.createMockChatRoom();
        const { dbManager } = require('../database');

        // Simulate IndexedDB failure
        dbManager.withWriteTransaction.mockRejectedValue(new Error('Save failed'));

        // Mock localStorage fallback
        const mockSetItem = jest.fn();
        const mockGetItem = jest.fn(() => JSON.stringify([]));
        Object.defineProperty(Storage.prototype, 'setItem', { value: mockSetItem });
        Object.defineProperty(Storage.prototype, 'getItem', { value: mockGetItem });

        await api.saveChatRoom(mockRoom);

        expect(mockSetItem).toHaveBeenCalled();
      });
    });

    describe('deleteChatRoom', () => {
      it('should delete chat room and associated messages', async () => {
        const roomId = 'test-room-id';
        const { dbManager, requestToPromise } = require('../database');
        const mockDelete = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: { delete: mockDelete },
            messages: {
              index: () => ({
                openCursor: () => ({
                  onsuccess: null,
                  onerror: null,
                  result: null
                })
              })
            }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.deleteChatRoom(roomId);

        expect(mockDelete).toHaveBeenCalledWith(roomId);
      });

      it('should handle deletion errors', async () => {
        const roomId = 'test-room-id';
        const { dbManager } = require('../database');

        dbManager.withWriteTransaction.mockRejectedValue(new Error('Delete failed'));

        await expect(api.deleteChatRoom(roomId)).rejects.toThrow();
      });
    });

    describe('updateChatRoom', () => {
      it('should update existing chat room', async () => {
        const mockRoom = TestDataFactory.createMockChatRoom();
        const updates = { name: 'Updated Name' };

        // Mock getChatRoom to return existing room
        const { dbManager, requestToPromise } = require('../database');
        
        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              get: () => ({ result: mockRoom })
            },
            messages: {
              index: () => ({
                getAll: () => ({ result: mockRoom.messages })
              })
            }
          });
        });

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: { put: jest.fn() },
            messages: { put: jest.fn() }
          });
        });

        requestToPromise.mockResolvedValue(mockRoom);
        requestToPromise.mockResolvedValue(mockRoom.messages);

        await api.updateChatRoom(mockRoom.id, updates);

        // Verify the updated room would be saved
        expect(dbManager.withWriteTransaction).toHaveBeenCalled();
      });

      it('should throw error for non-existent chat room', async () => {
        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            chatRooms: {
              get: () => ({ result: null })
            }
          });
        });

        requestToPromise.mockResolvedValue(null);

        await expect(api.updateChatRoom('non-existent', { name: 'New Name' }))
          .rejects.toThrow('Chat room with id non-existent not found');
      });
    });
  });

  describe('MessageStorageAPI', () => {
    let api: MessageStorageAPI;

    beforeEach(() => {
      api = new MessageStorageAPI();
    });

    describe('addMessage', () => {
      it('should add message to chat room', async () => {
        const chatRoomId = 'test-room';
        const message = TestDataFactory.createMockMessage();
        const { dbManager, requestToPromise } = require('../database');
        const mockPut = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            messages: { put: mockPut }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.addMessage(chatRoomId, message);

        expect(mockPut).toHaveBeenCalledWith({
          ...message,
          chatRoomId
        });
      });

      it('should fall back to localStorage when IndexedDB fails', async () => {
        const chatRoomId = 'test-room';
        const message = TestDataFactory.createMockMessage();
        const { dbManager } = require('../database');

        dbManager.withWriteTransaction.mockRejectedValue(new Error('Add failed'));

        // Mock ChatRoomStorageAPI for fallback
        const mockChatRoom = TestDataFactory.createMockChatRoom({ id: chatRoomId });
        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => JSON.stringify([{
            ...mockChatRoom,
            createdAt: mockChatRoom.createdAt.toISOString(),
            lastMessageAt: mockChatRoom.lastMessageAt.toISOString(),
            messages: mockChatRoom.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            }))
          }]))
        });

        const mockSetItem = jest.fn();
        Object.defineProperty(Storage.prototype, 'setItem', { value: mockSetItem });

        await api.addMessage(chatRoomId, message);

        expect(mockSetItem).toHaveBeenCalled();
      });
    });

    describe('getMessages', () => {
      it('should retrieve messages for chat room', async () => {
        const chatRoomId = 'test-room';
        const mockMessages = [
          TestDataFactory.createMockMessage(),
          TestDataFactory.createMockMessage()
        ];

        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            messages: {
              index: () => ({
                getAll: () => ({ result: mockMessages })
              })
            }
          });
        });

        requestToPromise.mockResolvedValue(mockMessages);

        const result = await api.getMessages(chatRoomId);

        expect(result).toEqual(mockMessages);
      });

      it('should support pagination', async () => {
        const chatRoomId = 'test-room';
        const mockMessages = Array.from({ length: 10 }, () => 
          TestDataFactory.createMockMessage()
        );

        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            messages: {
              index: () => ({
                getAll: () => ({ result: mockMessages })
              })
            }
          });
        });

        requestToPromise.mockResolvedValue(mockMessages);

        const result = await api.getMessages(chatRoomId, 5, 2);

        expect(result).toHaveLength(5);
      });
    });

    describe('deleteMessage', () => {
      it('should delete message by ID', async () => {
        const messageId = 'test-message';
        const { dbManager, requestToPromise } = require('../database');
        const mockDelete = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            messages: { delete: mockDelete }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.deleteMessage(messageId);

        expect(mockDelete).toHaveBeenCalledWith(messageId);
      });
    });
  });

  describe('SettingsStorageAPI', () => {
    let api: SettingsStorageAPI;

    beforeEach(() => {
      api = new SettingsStorageAPI();
    });

    describe('getSetting', () => {
      it('should retrieve setting value', async () => {
        const key = 'testSetting';
        const expectedValue = { theme: 'dark' };
        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            settings: {
              get: () => ({ result: { value: expectedValue } })
            }
          });
        });

        requestToPromise.mockResolvedValue({ value: expectedValue });

        const result = await api.getSetting(key);

        expect(result).toEqual(expectedValue);
      });

      it('should return default value when setting not found', async () => {
        const key = 'nonExistentSetting';
        const defaultValue = 'default';
        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            settings: {
              get: () => ({ result: null })
            }
          });
        });

        requestToPromise.mockResolvedValue(null);

        const result = await api.getSetting(key, defaultValue);

        expect(result).toBe(defaultValue);
      });

      it('should fall back to localStorage', async () => {
        const key = 'testSetting';
        const expectedValue = 'localStorage value';
        const { dbManager } = require('../database');

        dbManager.withReadTransaction.mockRejectedValue(new Error('DB error'));

        Object.defineProperty(Storage.prototype, 'getItem', {
          value: jest.fn(() => JSON.stringify(expectedValue))
        });

        const result = await api.getSetting(key);

        expect(result).toBe(expectedValue);
      });
    });

    describe('setSetting', () => {
      it('should save setting value', async () => {
        const key = 'testSetting';
        const value = { theme: 'dark' };
        const { dbManager, requestToPromise } = require('../database');
        const mockPut = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            settings: { put: mockPut }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.setSetting(key, value);

        expect(mockPut).toHaveBeenCalledWith({
          key,
          value,
          timestamp: expect.any(Date),
          version: 1
        });
      });
    });

    describe('getAllSettings', () => {
      it('should retrieve all settings', async () => {
        const mockSettings = [
          { key: 'setting1', value: 'value1' },
          { key: 'setting2', value: 'value2' }
        ];

        const { dbManager, cursorToArray } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            settings: {
              openCursor: () => ({ result: mockSettings })
            }
          });
        });

        cursorToArray.mockResolvedValue(mockSettings);

        const result = await api.getAllSettings();

        expect(result).toEqual({
          setting1: 'value1',
          setting2: 'value2'
        });
      });
    });
  });

  describe('TranscriptionStorageAPI', () => {
    let api: TranscriptionStorageAPI;

    beforeEach(() => {
      api = new TranscriptionStorageAPI();
    });

    describe('saveTranscription', () => {
      it('should save transcription data', async () => {
        const transcription = {
          id: 'test-transcription',
          chatRoomId: 'test-room',
          content: 'Hello world',
          isActive: true,
          isFinal: false
        };

        const { dbManager, requestToPromise } = require('../database');
        const mockPut = jest.fn();

        dbManager.withWriteTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            transcriptions: { put: mockPut }
          });
        });

        requestToPromise.mockResolvedValue(undefined);

        await api.saveTranscription(transcription);

        expect(mockPut).toHaveBeenCalledWith({
          ...transcription,
          timestamp: expect.any(Date)
        });
      });
    });

    describe('getTranscriptions', () => {
      it('should retrieve transcriptions for chat room', async () => {
        const chatRoomId = 'test-room';
        const mockTranscriptions = [
          {
            id: 'trans1',
            chatRoomId,
            content: 'First transcription',
            timestamp: new Date()
          },
          {
            id: 'trans2',
            chatRoomId,
            content: 'Second transcription',
            timestamp: new Date()
          }
        ];

        const { dbManager, requestToPromise } = require('../database');

        dbManager.withReadTransaction.mockImplementation(async (stores, callback) => {
          return callback({
            transcriptions: {
              index: () => ({
                getAll: () => ({ result: mockTranscriptions })
              })
            }
          });
        });

        requestToPromise.mockResolvedValue(mockTranscriptions);

        const result = await api.getTranscriptions(chatRoomId);

        expect(result).toEqual(mockTranscriptions);
      });
    });
  });

  describe('Error handling and retry logic', () => {
    it('should retry failed operations', async () => {
      const api = new ChatRoomStorageAPI({ retryAttempts: 3, retryDelay: 10 });
      const { dbManager } = require('../database');

      // Fail twice, succeed on third attempt
      dbManager.withReadTransaction
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce([]);

      const result = await api.getAllChatRooms();

      expect(dbManager.withReadTransaction).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('should throw error after max retry attempts', async () => {
      const api = new ChatRoomStorageAPI({ 
        retryAttempts: 2, 
        retryDelay: 10,
        useLocalStorageFallback: false 
      });
      const { dbManager } = require('../database');

      dbManager.withReadTransaction.mockRejectedValue(new Error('Persistent failure'));

      await expect(api.getAllChatRooms()).rejects.toThrow('Operation failed after 2 attempts');
      expect(dbManager.withReadTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle concurrent operations', async () => {
      const api = new ChatRoomStorageAPI();
      const { dbManager } = require('../database');

      dbManager.withReadTransaction.mockResolvedValue([]);

      // Execute multiple operations concurrently
      const promises = Array.from({ length: 5 }, () => api.getAllChatRooms());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toEqual([]));
    });

    it('should handle large datasets efficiently', async () => {
      const api = new ChatRoomStorageAPI();
      const largeDataset = TestDataFactory.createBulkTestData(100, 50);
      const { dbManager } = require('../database');

      dbManager.withReadTransaction.mockResolvedValue(largeDataset.rooms);

      const startTime = Date.now();
      const result = await api.getAllChatRooms();
      const endTime = Date.now();

      expect(result).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});