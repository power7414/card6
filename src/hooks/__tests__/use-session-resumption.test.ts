/**
 * Tests for useSessionResumption hook
 */

import { renderHook, act } from '@testing-library/react';
import { useSessionResumption } from '../use-session-resumption';
import { usePersistentChatStore } from '../../stores/chat-store-persistent';

// Mock the persistent chat store
jest.mock('../../stores/chat-store-persistent');

const mockUsePersistentChatStore = usePersistentChatStore as jest.MockedFunction<typeof usePersistentChatStore>;

describe('useSessionResumption', () => {
  const mockChatRooms = [
    {
      id: 'room-1',
      name: 'Test Room 1',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
      isActive: true,
      session: {
        sessionHandle: 'handle-123',
        lastConnected: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        isResumable: true
      }
    },
    {
      id: 'room-2',
      name: 'Test Room 2',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
      isActive: false,
      session: {
        sessionHandle: 'handle-456',
        lastConnected: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago (expired)
        isResumable: true
      }
    }
  ];

  beforeEach(() => {
    mockUsePersistentChatStore.mockReturnValue({
      chatRooms: mockChatRooms,
      activeChatRoom: 'room-1',
      currentTranscript: '',
      isRecording: false,
      isLoading: false,
      isInitialized: true,
      lastSyncedAt: new Date(),
      syncError: null,
      initialize: jest.fn(),
      addChatRoom: jest.fn(),
      setActiveChatRoom: jest.fn(),
      addMessage: jest.fn(),
      updateTranscript: jest.fn(),
      setRecording: jest.fn(),
      deleteChatRoom: jest.fn(),
      renameChatRoom: jest.fn(),
      clearTranscript: jest.fn(),
      syncFromStorage: jest.fn(),
      syncToStorage: jest.fn(),
      refreshChatRoom: jest.fn(),
    });

    // Mock setState method
    (usePersistentChatStore as any).setState = jest.fn();
    (usePersistentChatStore as any).getState = jest.fn().mockReturnValue({
      chatRooms: mockChatRooms,
      syncToStorage: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a valid session handle for a room with recent session', () => {
    const { result } = renderHook(() => useSessionResumption({ enableLogging: false }));

    const sessionHandle = result.current.getSessionHandle('room-1');
    expect(sessionHandle).toBe('handle-123');
  });

  it('should return null for a room with expired session', () => {
    const { result } = renderHook(() => useSessionResumption({ 
      enableLogging: false,
      maxSessionAge: 15 * 60 * 1000 // 15 minutes
    }));

    const sessionHandle = result.current.getSessionHandle('room-2');
    expect(sessionHandle).toBeNull();
  });

  it('should return null for a room that does not exist', () => {
    const { result } = renderHook(() => useSessionResumption({ enableLogging: false }));

    const sessionHandle = result.current.getSessionHandle('non-existent-room');
    expect(sessionHandle).toBeNull();
  });

  it('should correctly identify valid sessions', () => {
    const { result } = renderHook(() => useSessionResumption({ 
      enableLogging: false,
      maxSessionAge: 15 * 60 * 1000 
    }));

    expect(result.current.hasValidSession('room-1')).toBe(true);
    expect(result.current.hasValidSession('room-2')).toBe(false);
    expect(result.current.hasValidSession('non-existent')).toBe(false);
  });

  it('should provide session statistics', () => {
    const { result } = renderHook(() => useSessionResumption({ 
      enableLogging: false,
      maxSessionAge: 15 * 60 * 1000 
    }));

    const stats = result.current.getSessionStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.validSessions).toBe(1); // Only room-1 is valid
    expect(stats.expiredSessions).toBe(1); // room-2 is expired
  });

  it('should handle session resumption updates', async () => {
    const { result } = renderHook(() => useSessionResumption({ enableLogging: false }));

    await act(async () => {
      await result.current.handleSessionResumptionUpdate('room-1', {
        resumable: true,
        newHandle: 'new-handle-789'
      });
    });

    // Check that setState was called with updated session
    expect((usePersistentChatStore as any).setState).toHaveBeenCalled();
  });

  it('should clear session handles', async () => {
    const { result } = renderHook(() => useSessionResumption({ enableLogging: false }));

    await act(async () => {
      await result.current.clearSessionHandle('room-1');
    });

    // Check that setState was called to clear the session
    expect((usePersistentChatStore as any).setState).toHaveBeenCalled();
  });

  it('should handle non-resumable session updates', async () => {
    const { result } = renderHook(() => useSessionResumption({ enableLogging: false }));

    await act(async () => {
      await result.current.handleSessionResumptionUpdate('room-1', {
        resumable: false,
        newHandle: null
      });
    });

    // Should have called clearSessionHandle internally
    expect((usePersistentChatStore as any).setState).toHaveBeenCalled();
  });
});