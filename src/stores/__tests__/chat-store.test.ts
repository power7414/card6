/**
 * Unit tests for chat store (Zustand)
 * 
 * Tests state management functionality including:
 * - Store initialization
 * - Chat room operations (CRUD)
 * - Message management
 * - Transcript handling
 * - Recording state
 * - Error handling and rollback
 * - Persistence integration
 */

import { act, renderHook } from '@testing-library/react';
import { useChatStore } from '../chat-store';
import { storageService } from '../../lib/storage-service';
import { TestDataFactory } from '../../__tests__/utils/test-data-factory';
import { waitForAsync } from '../../__tests__/utils/test-helpers';

// Mock the storage service
jest.mock('../../lib/storage-service');
const mockStorageService = storageService as jest.Mocked<typeof storageService>;

// Mock timers for debounced operations
jest.useFakeTimers();

describe('Chat Store', () => {
  const mockChatRooms = TestDataFactory.createMockChatRooms(3);
  const mockMessage = TestDataFactory.createMockMessage();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset store state
    useChatStore.setState({
      chatRooms: [],
      activeChatRoom: null,
      currentTranscript: '',
      isRecording: false,
      isLoading: false
    });

    // Setup default mocks
    mockStorageService.getAllChatRooms.mockResolvedValue(mockChatRooms);
    mockStorageService.getSetting.mockImplementation((key, defaultValue) => {
      const settings: Record<string, any> = {
        activeChatRoom: mockChatRooms[0].id,
        currentTranscript: '',
        isRecording: false
      };
      return Promise.resolve(settings[key] ?? defaultValue);
    });
    mockStorageService.saveChatRoom.mockResolvedValue();
    mockStorageService.addMessage.mockResolvedValue();
    mockStorageService.deleteChatRoom.mockResolvedValue();
    mockStorageService.setSetting.mockResolvedValue();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.chatRooms).toEqual([]);
      expect(result.current.activeChatRoom).toBeNull();
      expect(result.current.currentTranscript).toBe('');
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should load data from storage on initialize', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockStorageService.getAllChatRooms).toHaveBeenCalled();
      expect(mockStorageService.getSetting).toHaveBeenCalledWith('activeChatRoom', null);
      expect(result.current.chatRooms).toEqual(mockChatRooms);
      expect(result.current.activeChatRoom).toBe(mockChatRooms[0].id);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStorageService.getAllChatRooms.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize chat store:',
        expect.any(Error)
      );
      expect(result.current.isLoading).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should not initialize twice if already loading', async () => {
      const { result } = renderHook(() => useChatStore());

      // Start first initialization
      const firstInit = act(() => result.current.initialize());
      
      // Try to initialize again while first is in progress
      const secondInit = act(() => result.current.initialize());

      await Promise.all([firstInit, secondInit]);

      // Should only call storage service once
      expect(mockStorageService.getAllChatRooms).toHaveBeenCalledTimes(1);
    });
  });

  describe('chat room management', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useChatStore());
      await act(async () => {
        await result.current.initialize();
      });
    });

    describe('addChatRoom', () => {
      it('should add new chat room optimistically', async () => {
        const { result } = renderHook(() => useChatStore());
        const newRoom = TestDataFactory.createMockChatRoom();

        await act(async () => {
          await result.current.addChatRoom(newRoom);
        });

        expect(result.current.chatRooms).toContain(newRoom);
        expect(result.current.chatRooms[0]).toBe(newRoom); // Should be first (newest)
        expect(mockStorageService.saveChatRoom).toHaveBeenCalledWith(newRoom);
      });

      it('should rollback on storage failure', async () => {
        const { result } = renderHook(() => useChatStore());
        const newRoom = TestDataFactory.createMockChatRoom();
        const initialRooms = [...result.current.chatRooms];

        mockStorageService.saveChatRoom.mockRejectedValue(new Error('Save failed'));

        await act(async () => {
          await expect(result.current.addChatRoom(newRoom)).rejects.toThrow('Save failed');
        });

        expect(result.current.chatRooms).toEqual(initialRooms);
      });
    });

    describe('setActiveChatRoom', () => {
      it('should set active chat room and update timestamps', async () => {
        const { result } = renderHook(() => useChatStore());
        const targetRoomId = mockChatRooms[1].id;

        await act(async () => {
          await result.current.setActiveChatRoom(targetRoomId);
        });

        expect(result.current.activeChatRoom).toBe(targetRoomId);
        
        // Find the activated room and check it's marked as active
        const activatedRoom = result.current.chatRooms.find(room => room.id === targetRoomId);
        expect(activatedRoom?.isActive).toBe(true);
        
        // Other rooms should be inactive
        const otherRooms = result.current.chatRooms.filter(room => room.id !== targetRoomId);
        otherRooms.forEach(room => {
          expect(room.isActive).toBe(false);
        });

        expect(mockStorageService.setSetting).toHaveBeenCalledWith('activeChatRoom', targetRoomId);
        expect(mockStorageService.saveChatRoom).toHaveBeenCalledWith(activatedRoom);
      });

      it('should handle setting persistence errors gracefully', async () => {
        const { result } = renderHook(() => useChatStore());
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        mockStorageService.setSetting.mockRejectedValue(new Error('Setting save failed'));

        await act(async () => {
          await result.current.setActiveChatRoom(mockChatRooms[1].id);
        });

        // State should still be updated despite persistence error
        expect(result.current.activeChatRoom).toBe(mockChatRooms[1].id);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to persist active chat room:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });
    });

    describe('deleteChatRoom', () => {
      it('should delete chat room and clear active if needed', async () => {
        const { result } = renderHook(() => useChatStore());
        const roomToDelete = mockChatRooms[1].id;
        const initialCount = result.current.chatRooms.length;

        await act(async () => {
          await result.current.deleteChatRoom(roomToDelete);
        });

        expect(result.current.chatRooms).toHaveLength(initialCount - 1);
        expect(result.current.chatRooms.find(room => room.id === roomToDelete)).toBeUndefined();
        expect(mockStorageService.deleteChatRoom).toHaveBeenCalledWith(roomToDelete);
      });

      it('should clear active chat room when deleting active room', async () => {
        const { result } = renderHook(() => useChatStore());
        const activeRoomId = result.current.activeChatRoom!;

        await act(async () => {
          await result.current.deleteChatRoom(activeRoomId);
        });

        expect(result.current.activeChatRoom).toBeNull();
        expect(mockStorageService.setSetting).toHaveBeenCalledWith('activeChatRoom', null);
      });

      it('should handle deletion errors', async () => {
        const { result } = renderHook(() => useChatStore());
        const roomToDelete = mockChatRooms[1].id;
        
        mockStorageService.deleteChatRoom.mockRejectedValue(new Error('Delete failed'));

        await act(async () => {
          await expect(result.current.deleteChatRoom(roomToDelete)).rejects.toThrow('Delete failed');
        });
      });
    });

    describe('renameChatRoom', () => {
      it('should rename chat room optimistically', async () => {
        const { result } = renderHook(() => useChatStore());
        const roomToRename = mockChatRooms[1].id;
        const newName = 'Updated Room Name';

        await act(async () => {
          await result.current.renameChatRoom(roomToRename, newName);
        });

        const renamedRoom = result.current.chatRooms.find(room => room.id === roomToRename);
        expect(renamedRoom?.name).toBe(newName);
        expect(mockStorageService.saveChatRoom).toHaveBeenCalledWith(renamedRoom);
      });

      it('should rollback on rename failure', async () => {
        const { result } = renderHook(() => useChatStore());
        const roomToRename = mockChatRooms[1].id;
        const originalName = mockChatRooms[1].name;
        const newName = 'Updated Room Name';
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        mockStorageService.saveChatRoom.mockRejectedValue(new Error('Rename failed'));

        await act(async () => {
          await expect(result.current.renameChatRoom(roomToRename, newName)).rejects.toThrow();
        });

        // Should revert to original name
        const room = result.current.chatRooms.find(room => room.id === roomToRename);
        expect(room?.name).toBe(originalName);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('message management', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useChatStore());
      await act(async () => {
        await result.current.initialize();
      });
    });

    it('should add message to chat room optimistically', async () => {
      const { result } = renderHook(() => useChatStore());
      const chatRoomId = mockChatRooms[0].id;
      const newMessage = TestDataFactory.createMockMessage();

      await act(async () => {
        await result.current.addMessage(chatRoomId, newMessage);
      });

      const chatRoom = result.current.chatRooms.find(room => room.id === chatRoomId);
      expect(chatRoom?.messages).toContain(newMessage);
      expect(chatRoom?.lastMessageAt).toBeInstanceOf(Date);
      expect(mockStorageService.addMessage).toHaveBeenCalledWith(chatRoomId, newMessage);
    });

    it('should rollback message on storage failure', async () => {
      const { result } = renderHook(() => useChatStore());
      const chatRoomId = mockChatRooms[0].id;
      const newMessage = TestDataFactory.createMockMessage();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const initialRoom = result.current.chatRooms.find(room => room.id === chatRoomId);
      const initialMessageCount = initialRoom?.messages.length || 0;

      mockStorageService.addMessage.mockRejectedValue(new Error('Add message failed'));

      await act(async () => {
        await expect(result.current.addMessage(chatRoomId, newMessage)).rejects.toThrow();
      });

      const updatedRoom = result.current.chatRooms.find(room => room.id === chatRoomId);
      expect(updatedRoom?.messages).toHaveLength(initialMessageCount);
      expect(updatedRoom?.messages.find(msg => msg.id === newMessage.id)).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('transcript management', () => {
    it('should update transcript immediately', () => {
      const { result } = renderHook(() => useChatStore());
      const newTranscript = 'Hello world';

      act(() => {
        result.current.updateTranscript(newTranscript);
      });

      expect(result.current.currentTranscript).toBe(newTranscript);
    });

    it('should debounce transcript persistence', async () => {
      const { result } = renderHook(() => useChatStore());
      const transcript1 = 'Hello';
      const transcript2 = 'Hello world';

      act(() => {
        result.current.updateTranscript(transcript1);
      });

      act(() => {
        result.current.updateTranscript(transcript2);
      });

      // Storage should not be called immediately
      expect(mockStorageService.setSetting).not.toHaveBeenCalled();

      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitForAsync(10);

      // Should only save the latest value
      expect(mockStorageService.setSetting).toHaveBeenCalledTimes(1);
      expect(mockStorageService.setSetting).toHaveBeenCalledWith('currentTranscript', transcript2);
    });

    it('should handle transcript persistence errors gracefully', async () => {
      const { result } = renderHook(() => useChatStore());
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockStorageService.setSetting.mockRejectedValue(new Error('Persist failed'));

      act(() => {
        result.current.updateTranscript('Test transcript');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitForAsync(10);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist transcript:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should clear transcript', () => {
      const { result } = renderHook(() => useChatStore());

      // Set some transcript first
      act(() => {
        result.current.updateTranscript('Some text');
      });

      expect(result.current.currentTranscript).toBe('Some text');

      // Clear transcript
      act(() => {
        result.current.clearTranscript();
      });

      expect(result.current.currentTranscript).toBe('');
    });
  });

  describe('recording state', () => {
    it('should set recording state and persist', async () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setRecording(true);
      });

      expect(result.current.isRecording).toBe(true);
      
      await waitForAsync(10);
      
      expect(mockStorageService.setSetting).toHaveBeenCalledWith('isRecording', true);
    });

    it('should handle recording persistence errors gracefully', async () => {
      const { result } = renderHook(() => useChatStore());
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockStorageService.setSetting.mockRejectedValue(new Error('Recording persist failed'));

      act(() => {
        result.current.setRecording(true);
      });

      await waitForAsync(10);

      // State should still be updated despite persistence error
      expect(result.current.isRecording).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist recording state:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent chat room operations', async () => {
      const { result } = renderHook(() => useChatStore());
      
      await act(async () => {
        await result.current.initialize();
      });

      const room1 = TestDataFactory.createMockChatRoom();
      const room2 = TestDataFactory.createMockChatRoom();

      await act(async () => {
        await Promise.all([
          result.current.addChatRoom(room1),
          result.current.addChatRoom(room2)
        ]);
      });

      expect(result.current.chatRooms).toContain(room1);
      expect(result.current.chatRooms).toContain(room2);
    });

    it('should handle concurrent message additions', async () => {
      const { result } = renderHook(() => useChatStore());
      
      await act(async () => {
        await result.current.initialize();
      });

      const chatRoomId = mockChatRooms[0].id;
      const message1 = TestDataFactory.createMockMessage();
      const message2 = TestDataFactory.createMockMessage();

      await act(async () => {
        await Promise.all([
          result.current.addMessage(chatRoomId, message1),
          result.current.addMessage(chatRoomId, message2)
        ]);
      });

      const chatRoom = result.current.chatRooms.find(room => room.id === chatRoomId);
      expect(chatRoom?.messages).toContain(message1);
      expect(chatRoom?.messages).toContain(message2);
    });
  });

  describe('edge cases', () => {
    it('should handle operations on non-existent chat rooms gracefully', async () => {
      const { result } = renderHook(() => useChatStore());
      
      await act(async () => {
        await result.current.initialize();
      });

      const message = TestDataFactory.createMockMessage();

      await act(async () => {
        await result.current.addMessage('non-existent-room', message);
      });

      // Should not crash or add message to any room
      result.current.chatRooms.forEach(room => {
        expect(room.messages.find(msg => msg.id === message.id)).toBeUndefined();
      });
    });

    it('should handle empty chat rooms list', async () => {
      mockStorageService.getAllChatRooms.mockResolvedValue([]);
      
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.chatRooms).toEqual([]);
      expect(result.current.activeChatRoom).toBeNull();
    });
  });

  describe('state consistency', () => {
    it('should maintain referential equality for unchanged data', async () => {
      const { result, rerender } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initialize();
      });

      const firstRender = result.current.chatRooms;
      
      rerender();

      // Chat rooms should be the same reference if not modified
      expect(result.current.chatRooms).toBe(firstRender);
    });

    it('should update references only for modified data', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.initialize();
      });

      const initialRooms = result.current.chatRooms;
      const roomToModify = initialRooms[0];
      const otherRooms = initialRooms.slice(1);

      // Add message to first room
      const newMessage = TestDataFactory.createMockMessage();
      
      await act(async () => {
        await result.current.addMessage(roomToModify.id, newMessage);
      });

      const updatedRooms = result.current.chatRooms;
      const updatedRoom = updatedRooms.find(room => room.id === roomToModify.id);

      // Modified room should have new reference
      expect(updatedRoom).not.toBe(roomToModify);
      
      // Other rooms should maintain their references
      otherRooms.forEach(originalRoom => {
        const unchangedRoom = updatedRooms.find(room => room.id === originalRoom.id);
        expect(unchangedRoom).toBe(originalRoom);
      });
    });
  });
});