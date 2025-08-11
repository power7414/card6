/**
 * Unit tests for useChatManager hook
 * 
 * Tests chat room management functionality including:
 * - Creating new chat rooms
 * - Switching between chat rooms
 * - Deleting chat rooms with confirmation
 * - Renaming chat rooms
 * - Error handling and loading states
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatManager } from '../use-chat-manager';
import { useChatStore } from '../../stores/chat-store';
import { TestDataFactory } from '../../__tests__/utils/test-data-factory';
import { waitForAsync } from '../../__tests__/utils/test-helpers';

// Mock the chat store
jest.mock('../../stores/chat-store');
const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;

// Mock window.confirm and window.prompt
const mockConfirm = jest.fn();
const mockPrompt = jest.fn();
const mockAlert = jest.fn();

Object.defineProperty(window, 'confirm', { value: mockConfirm });
Object.defineProperty(window, 'prompt', { value: mockPrompt });
Object.defineProperty(window, 'alert', { value: mockAlert });

describe('useChatManager', () => {
  // Mock store methods
  const mockInitialize = jest.fn();
  const mockAddChatRoom = jest.fn();
  const mockSetActiveChatRoom = jest.fn();
  const mockDeleteChatRoom = jest.fn();
  const mockRenameChatRoom = jest.fn();

  // Test data
  const mockChatRooms = TestDataFactory.createMockChatRooms(3);
  const activeChatRoomId = mockChatRooms[0].id;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementation
    mockUseChatStore.mockReturnValue({
      chatRooms: mockChatRooms,
      activeChatRoom: activeChatRoomId,
      isLoading: false,
      initialize: mockInitialize,
      addChatRoom: mockAddChatRoom,
      setActiveChatRoom: mockSetActiveChatRoom,
      deleteChatRoom: mockDeleteChatRoom,
      renameChatRoom: mockRenameChatRoom
    });

    mockInitialize.mockResolvedValue(undefined);
    mockAddChatRoom.mockResolvedValue(undefined);
    mockSetActiveChatRoom.mockResolvedValue(undefined);
    mockDeleteChatRoom.mockResolvedValue(undefined);
    mockRenameChatRoom.mockResolvedValue(undefined);
    mockConfirm.mockReturnValue(true);
    mockPrompt.mockReturnValue('New Room Name');
  });

  describe('initialization', () => {
    it('should initialize the store on mount', async () => {
      renderHook(() => useChatManager());

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledTimes(1);
      });
    });

    it('should only initialize once even on re-renders', async () => {
      const { rerender } = renderHook(() => useChatManager());
      
      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledTimes(1);
      });

      rerender();
      
      // Should not call initialize again
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNewChatRoom', () => {
    it('should create a new chat room successfully', async () => {
      const { result } = renderHook(() => useChatManager());

      let newRoomId: string | undefined;

      await act(async () => {
        newRoomId = await result.current.createNewChatRoom();
      });

      expect(newRoomId).toBeDefined();
      expect(mockAddChatRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^chatroom_\d+$/),
          name: `對話 ${mockChatRooms.length + 1}`,
          messages: [],
          isActive: true,
          createdAt: expect.any(Date),
          lastMessageAt: expect.any(Date)
        })
      );
      expect(mockSetActiveChatRoom).toHaveBeenCalledWith(newRoomId);
    });

    it('should handle creation errors', async () => {
      const { result } = renderHook(() => useChatManager());
      const error = new Error('Failed to create chat room');
      
      mockAddChatRoom.mockRejectedValueOnce(error);

      await act(async () => {
        await expect(result.current.createNewChatRoom()).rejects.toThrow(error);
      });

      expect(mockAddChatRoom).toHaveBeenCalled();
    });

    it('should generate incremental room names', async () => {
      const { result } = renderHook(() => useChatManager());

      await act(async () => {
        await result.current.createNewChatRoom();
      });

      expect(mockAddChatRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `對話 ${mockChatRooms.length + 1}`
        })
      );
    });
  });

  describe('switchChatRoom', () => {
    it('should switch to specified chat room', async () => {
      const { result } = renderHook(() => useChatManager());
      const targetRoomId = mockChatRooms[1].id;

      await act(async () => {
        await result.current.switchChatRoom(targetRoomId);
      });

      expect(mockSetActiveChatRoom).toHaveBeenCalledWith(targetRoomId);
    });

    it('should handle switch errors gracefully', async () => {
      const { result } = renderHook(() => useChatManager());
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockSetActiveChatRoom.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.switchChatRoom('invalid-id');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to switch chat room:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getActiveChatRoom', () => {
    it('should return the active chat room', () => {
      const { result } = renderHook(() => useChatManager());
      
      const activeChatRoom = result.current.getActiveChatRoom();
      
      expect(activeChatRoom).toEqual(mockChatRooms[0]);
    });

    it('should return undefined when no active chat room', () => {
      mockUseChatStore.mockReturnValue({
        chatRooms: mockChatRooms,
        activeChatRoom: null,
        isLoading: false,
        initialize: mockInitialize,
        addChatRoom: mockAddChatRoom,
        setActiveChatRoom: mockSetActiveChatRoom,
        deleteChatRoom: mockDeleteChatRoom,
        renameChatRoom: mockRenameChatRoom
      });

      const { result } = renderHook(() => useChatManager());
      
      const activeChatRoom = result.current.getActiveChatRoom();
      
      expect(activeChatRoom).toBeUndefined();
    });
  });

  describe('deleteChatRoomWithConfirm', () => {
    it('should delete chat room after confirmation', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToDelete = mockChatRooms[1];

      await act(async () => {
        await result.current.deleteChatRoomWithConfirm(roomToDelete.id);
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        `確定要刪除「${roomToDelete.name}」嗎？此操作無法恢復。`
      );
      expect(mockDeleteChatRoom).toHaveBeenCalledWith(roomToDelete.id);
    });

    it('should not delete if user cancels confirmation', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToDelete = mockChatRooms[1];
      
      mockConfirm.mockReturnValueOnce(false);

      await act(async () => {
        await result.current.deleteChatRoomWithConfirm(roomToDelete.id);
      });

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockDeleteChatRoom).not.toHaveBeenCalled();
    });

    it('should do nothing if chat room not found', async () => {
      const { result } = renderHook(() => useChatManager());

      await act(async () => {
        await result.current.deleteChatRoomWithConfirm('non-existent-id');
      });

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(mockDeleteChatRoom).not.toHaveBeenCalled();
    });

    it('should switch to another room when deleting active room', async () => {
      const { result } = renderHook(() => useChatManager());
      const activeRoomId = mockChatRooms[0].id;

      await act(async () => {
        await result.current.deleteChatRoomWithConfirm(activeRoomId);
      });

      expect(mockDeleteChatRoom).toHaveBeenCalledWith(activeRoomId);
      expect(mockSetActiveChatRoom).toHaveBeenCalledWith(mockChatRooms[1].id);
    });

    it('should handle deletion errors', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToDelete = mockChatRooms[1];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockDeleteChatRoom.mockRejectedValueOnce(new Error('Deletion failed'));

      await act(async () => {
        await result.current.deleteChatRoomWithConfirm(roomToDelete.id);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete chat room:',
        expect.any(Error)
      );
      expect(mockAlert).toHaveBeenCalledWith('刪除聊天室失敗，請稍後再試。');
      
      consoleSpy.mockRestore();
    });
  });

  describe('renameChatRoomWithPrompt', () => {
    it('should rename chat room with user input', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToRename = mockChatRooms[1];
      const newName = 'Updated Room Name';
      
      mockPrompt.mockReturnValueOnce(newName);

      await act(async () => {
        await result.current.renameChatRoomWithPrompt(roomToRename.id);
      });

      expect(mockPrompt).toHaveBeenCalledWith(
        '請輸入新的聊天室名稱：',
        roomToRename.name
      );
      expect(mockRenameChatRoom).toHaveBeenCalledWith(roomToRename.id, newName);
    });

    it('should not rename if user cancels prompt', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToRename = mockChatRooms[1];
      
      mockPrompt.mockReturnValueOnce(null);

      await act(async () => {
        await result.current.renameChatRoomWithPrompt(roomToRename.id);
      });

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockRenameChatRoom).not.toHaveBeenCalled();
    });

    it('should not rename if user enters empty name', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToRename = mockChatRooms[1];
      
      mockPrompt.mockReturnValueOnce('  ');

      await act(async () => {
        await result.current.renameChatRoomWithPrompt(roomToRename.id);
      });

      expect(mockRenameChatRoom).not.toHaveBeenCalled();
    });

    it('should do nothing if chat room not found', async () => {
      const { result } = renderHook(() => useChatManager());

      await act(async () => {
        await result.current.renameChatRoomWithPrompt('non-existent-id');
      });

      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockRenameChatRoom).not.toHaveBeenCalled();
    });

    it('should handle rename errors', async () => {
      const { result } = renderHook(() => useChatManager());
      const roomToRename = mockChatRooms[1];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRenameChatRoom.mockRejectedValueOnce(new Error('Rename failed'));

      await act(async () => {
        await result.current.renameChatRoomWithPrompt(roomToRename.id);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to rename chat room:',
        expect.any(Error)
      );
      expect(mockAlert).toHaveBeenCalledWith('重新命名聊天室失敗，請稍後再試。');
      
      consoleSpy.mockRestore();
    });
  });

  describe('loading states', () => {
    it('should reflect loading state from store', () => {
      mockUseChatStore.mockReturnValue({
        chatRooms: [],
        activeChatRoom: null,
        isLoading: true,
        initialize: mockInitialize,
        addChatRoom: mockAddChatRoom,
        setActiveChatRoom: mockSetActiveChatRoom,
        deleteChatRoom: mockDeleteChatRoom,
        renameChatRoom: mockRenameChatRoom
      });

      const { result } = renderHook(() => useChatManager());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('memoization', () => {
    it('should memoize functions to prevent unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useChatManager());
      
      const firstRender = {
        createNewChatRoom: result.current.createNewChatRoom,
        switchChatRoom: result.current.switchChatRoom,
        getActiveChatRoom: result.current.getActiveChatRoom,
        deleteChatRoomWithConfirm: result.current.deleteChatRoomWithConfirm,
        renameChatRoomWithPrompt: result.current.renameChatRoomWithPrompt
      };

      rerender();

      expect(result.current.createNewChatRoom).toBe(firstRender.createNewChatRoom);
      expect(result.current.switchChatRoom).toBe(firstRender.switchChatRoom);
      expect(result.current.getActiveChatRoom).toBe(firstRender.getActiveChatRoom);
      expect(result.current.deleteChatRoomWithConfirm).toBe(firstRender.deleteChatRoomWithConfirm);
      expect(result.current.renameChatRoomWithPrompt).toBe(firstRender.renameChatRoomWithPrompt);
    });
  });
});