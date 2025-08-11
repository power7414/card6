/**
 * Session Resumption Hook for Google Live API
 * 
 * Manages session handles for each chat room, enabling conversation continuity
 * across reconnections and providing seamless user experience.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { ChatRoomSession } from '../types/chat';

interface SessionResumptionUpdate {
  resumable: boolean;
  newHandle: string | null;
}

interface UseSessionResumptionOptions {
  /**
   * Maximum age of a session handle before it's considered expired (in milliseconds)
   * Default: 15 minutes (15 * 60 * 1000)
   */
  maxSessionAge?: number;
  
  /**
   * Whether to automatically clean up expired session handles
   * Default: true
   */
  autoCleanupExpired?: boolean;
  
  /**
   * Whether to enable debug logging for session operations
   * Default: false
   */
  enableLogging?: boolean;
}

interface UseSessionResumptionReturn {
  /**
   * Get the current session handle for a chat room
   */
  getSessionHandle: (chatRoomId: string) => string | null;
  
  /**
   * Store a new session handle for a chat room
   */
  storeSessionHandle: (chatRoomId: string, handle: string) => Promise<void>;
  
  /**
   * Clear session handle for a chat room
   */
  clearSessionHandle: (chatRoomId: string) => Promise<void>;
  
  /**
   * Handle session resumption update events from Live API
   */
  handleSessionResumptionUpdate: (chatRoomId: string, update: SessionResumptionUpdate) => Promise<void>;
  
  /**
   * Check if a chat room has a valid (non-expired) session handle
   */
  hasValidSession: (chatRoomId: string) => boolean;
  
  /**
   * Clean up all expired session handles across chat rooms
   */
  cleanupExpiredSessions: () => Promise<void>;
  
  /**
   * Get session statistics for debugging
   */
  getSessionStats: () => {
    totalSessions: number;
    validSessions: number;
    expiredSessions: number;
  };
}

const DEFAULT_MAX_SESSION_AGE = 15 * 60 * 1000; // 15 minutes

export function useSessionResumption(options: UseSessionResumptionOptions = {}): UseSessionResumptionReturn {
  const {
    maxSessionAge = DEFAULT_MAX_SESSION_AGE,
    autoCleanupExpired = true,
    enableLogging = false
  } = options;

  const { chatRooms } = usePersistentChatStore();
  
  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[SessionResumption] ${message}`, data || '');
    }
  }, [enableLogging]);

  const getSessionHandle = useCallback((chatRoomId: string): string | null => {
    const chatRoom = chatRooms.find(room => room.id === chatRoomId);
    if (!chatRoom?.session) {
      return null;
    }

    const { sessionHandle, lastConnected, isResumable } = chatRoom.session;
    
    // Check if session is still valid
    if (!sessionHandle || !lastConnected || !isResumable) {
      return null;
    }

    // Check if session has expired
    const sessionAge = Date.now() - lastConnected.getTime();
    if (sessionAge > maxSessionAge) {
      log(`Session handle expired for room ${chatRoomId}`, { age: sessionAge, maxAge: maxSessionAge });
      return null;
    }

    log(`Retrieved valid session handle for room ${chatRoomId}`);
    return sessionHandle;
  }, [chatRooms, maxSessionAge, log]);

  const storeSessionHandle = useCallback(async (chatRoomId: string, handle: string): Promise<void> => {
    try {
      const store = usePersistentChatStore.getState();
      const chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
      
      if (!chatRoom) {
        throw new Error(`Chat room ${chatRoomId} not found`);
      }

      // Create updated session data
      const updatedSession: ChatRoomSession = {
        sessionHandle: handle,
        lastConnected: new Date(),
        isResumable: true
      };

      // Update the chat room with new session data
      const updatedChatRoom = {
        ...chatRoom,
        session: updatedSession
      };

      // Use the proper store action to update the chat room
      // Since there's no direct updateChatRoom method, we need to work with the store state
      const currentState = usePersistentChatStore.getState();
      
      // Create a new array with the updated chat room
      const updatedChatRooms = currentState.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      // Update the store state directly (this is not ideal but works for our use case)
      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });

      // Trigger store synchronization
      await store.syncToStorage();

      log(`Stored session handle for room ${chatRoomId}`, { handle: handle.substring(0, 16) + '...' });
    } catch (error) {
      console.error(`Failed to store session handle for room ${chatRoomId}:`, error);
      throw error;
    }
  }, [log]);

  const clearSessionHandle = useCallback(async (chatRoomId: string): Promise<void> => {
    try {
      const store = usePersistentChatStore.getState();
      const chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
      
      if (!chatRoom) {
        log(`Chat room ${chatRoomId} not found, nothing to clear`);
        return;
      }

      // Clear session data
      const clearedSession: ChatRoomSession = {
        sessionHandle: null,
        lastConnected: null,
        isResumable: false
      };

      // Update the chat room
      const updatedChatRoom = {
        ...chatRoom,
        session: clearedSession
      };

      // Create updated chat rooms array
      const currentState = usePersistentChatStore.getState();
      const updatedChatRooms = currentState.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      // Update the store state
      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });

      // Trigger store synchronization
      await store.syncToStorage();

      log(`Cleared session handle for room ${chatRoomId}`);
    } catch (error) {
      console.error(`Failed to clear session handle for room ${chatRoomId}:`, error);
      throw error;
    }
  }, [log]);

  const handleSessionResumptionUpdate = useCallback(async (
    chatRoomId: string, 
    update: SessionResumptionUpdate
  ): Promise<void> => {
    try {
      log(`Handling session resumption update for room ${chatRoomId}`, update);

      if (update.resumable && update.newHandle) {
        // Store the new session handle
        await storeSessionHandle(chatRoomId, update.newHandle);
      } else {
        // Clear the session handle if not resumable or no handle provided
        await clearSessionHandle(chatRoomId);
      }
    } catch (error) {
      console.error(`Failed to handle session resumption update for room ${chatRoomId}:`, error);
      throw error;
    }
  }, [storeSessionHandle, clearSessionHandle, log]);

  const hasValidSession = useCallback((chatRoomId: string): boolean => {
    return getSessionHandle(chatRoomId) !== null;
  }, [getSessionHandle]);

  const cleanupExpiredSessions = useCallback(async (): Promise<void> => {
    try {
      const store = usePersistentChatStore.getState();
      let cleanedCount = 0;
      
      const updatedChatRooms = await Promise.all(
        store.chatRooms.map(async (chatRoom) => {
          if (!chatRoom.session?.sessionHandle || !chatRoom.session?.lastConnected) {
            return chatRoom;
          }

          const sessionAge = Date.now() - chatRoom.session.lastConnected.getTime();
          if (sessionAge > maxSessionAge) {
            cleanedCount++;
            log(`Cleaning up expired session for room ${chatRoom.id}`, { age: sessionAge });
            
            return {
              ...chatRoom,
              session: {
                sessionHandle: null,
                lastConnected: null,
                isResumable: false
              }
            };
          }

          return chatRoom;
        })
      );

      if (cleanedCount > 0) {
        // Update store with cleaned chat rooms
        store.chatRooms = updatedChatRooms;
        await store.syncToStorage();
        log(`Cleaned up ${cleanedCount} expired sessions`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      throw error;
    }
  }, [maxSessionAge, log]);

  const getSessionStats = useCallback(() => {
    const now = Date.now();
    let totalSessions = 0;
    let validSessions = 0;
    let expiredSessions = 0;

    for (const chatRoom of chatRooms) {
      if (chatRoom.session?.sessionHandle) {
        totalSessions++;
        
        if (chatRoom.session.lastConnected) {
          const sessionAge = now - chatRoom.session.lastConnected.getTime();
          if (sessionAge <= maxSessionAge && chatRoom.session.isResumable) {
            validSessions++;
          } else {
            expiredSessions++;
          }
        } else {
          expiredSessions++;
        }
      }
    }

    return {
      totalSessions,
      validSessions,
      expiredSessions
    };
  }, [chatRooms, maxSessionAge]);

  // Auto-cleanup expired sessions if enabled
  const cleanupInterval = useRef<NodeJS.Timeout>();
  
  // Set up periodic cleanup effect
  useEffect(() => {
    if (autoCleanupExpired) {
      cleanupInterval.current = setInterval(() => {
        cleanupExpiredSessions().catch(error => {
          console.error('Auto cleanup failed:', error);
        });
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
        cleanupInterval.current = undefined;
      }
    };
  }, [autoCleanupExpired, cleanupExpiredSessions]);

  return {
    getSessionHandle,
    storeSessionHandle,
    clearSessionHandle,
    handleSessionResumptionUpdate,
    hasValidSession,
    cleanupExpiredSessions,
    getSessionStats
  };
}