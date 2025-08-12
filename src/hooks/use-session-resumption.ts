/**
 * Session Resumption Hook for Google Live API
 * 
 * Manages session handles for each chat room, enabling conversation continuity
 * across reconnections and providing seamless user experience.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { ChatRoomSession } from '../types/chat';
import { sessionDebugLogger } from '../utils/session-debug';

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
      // Only log important events, not routine checks
      if (message.includes('✅') || message.includes('❌') || message.includes('Handling') || message.includes('store')) {
        console.log(`[SessionResumption] ${message}`, data || '');
      }
    }
  }, [enableLogging]);

  const getSessionHandle = useCallback((chatRoomId: string): string | null => {
    const chatRoom = chatRooms.find(room => room.id === chatRoomId);
    
    if (!chatRoom?.session) {
      log(`⚠️ [getSessionHandle] 沒有找到 session 數據:`, chatRoomId);
      return null;
    }

    const { sessionHandle, lastConnected, isResumable } = chatRoom.session;
    
    // Enhanced debugging for session validation
    const sessionAge = lastConnected ? Date.now() - lastConnected.getTime() : null;
    const isExpired = sessionAge ? sessionAge > maxSessionAge : true;
    
    sessionDebugLogger.log('session_handle_check', {
      chatRoomId,
      sessionHandle: sessionHandle,
      resumable: isResumable,
      indexedDBState: {
        hasHandle: !!sessionHandle,
        hasLastConnected: !!lastConnected,
        isResumable,
        sessionAgeMs: sessionAge,
        isExpired,
        maxSessionAge
      }
    });
    
    log(`Session data for room ${chatRoomId}:`, {
      hasHandle: !!sessionHandle,
      handlePreview: sessionHandle ? `${sessionHandle.substring(0, 16)}...` : null,
      hasLastConnected: !!lastConnected,
      lastConnectedTime: lastConnected?.toISOString(),
      isResumable,
      sessionAgeMinutes: sessionAge ? (sessionAge / (1000 * 60)).toFixed(1) : 'unknown',
      isExpired
    });
    
    // Check if session is still valid
    if (!sessionHandle || !lastConnected || !isResumable) {
      log(`Invalid session data for room ${chatRoomId}`, { 
        sessionHandle: !!sessionHandle, 
        lastConnected: !!lastConnected, 
        isResumable 
      });
      return null;
    }

    // Check if session has expired
    if (isExpired) {
      log(`Session handle expired for room ${chatRoomId}`, { 
        age: sessionAge, 
        maxAge: maxSessionAge,
        ageMinutes: sessionAge ? (sessionAge / (1000 * 60)).toFixed(1) : 'unknown'
      });
      return null;
    }

    log(`Retrieved valid session handle for room ${chatRoomId}`, { 
      handlePreview: `${sessionHandle.substring(0, 16)}...`,
      ageMinutes: sessionAge ? (sessionAge / (1000 * 60)).toFixed(1) : 'unknown'
    });
    return sessionHandle;
  }, [chatRooms, maxSessionAge, log]);

  const storeSessionHandle = useCallback(async (chatRoomId: string, handle: string): Promise<void> => {
    try {
      log(`Starting to store session handle for room ${chatRoomId}`, { handlePreview: handle.substring(0, 16) + '...' });
      
      // Wait for store synchronization with retry logic
      let chatRoom = null;
      let attempts = 0;
      const maxAttempts = 10;
      const retryDelay = 100; // 100ms
      
      while (!chatRoom && attempts < maxAttempts) {
        const store = usePersistentChatStore.getState();
        chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
        
        if (!chatRoom) {
          attempts++;
          // log(`Chat room ${chatRoomId} not found, attempt ${attempts}/${maxAttempts}. Waiting for store sync...`);
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Force refresh from storage if still not found after several attempts
            if (attempts === 5) {
              log(`Force syncing from storage for room ${chatRoomId}`);
              await store.syncFromStorage();
            }
          }
        }
      }
      
      if (!chatRoom) {
        // Final attempt - try to refresh the specific chat room
        const store = usePersistentChatStore.getState();
        await store.refreshChatRoom(chatRoomId);
        chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
        
        if (!chatRoom) {
          throw new Error(`Chat room ${chatRoomId} not found after ${maxAttempts} attempts and forced refresh`);
        }
      }

      log(`Found chat room ${chatRoomId}`, { 
        existingSession: !!chatRoom.session,
        existingHandle: chatRoom.session?.sessionHandle ? `${chatRoom.session.sessionHandle.substring(0, 16)}...` : null
      });

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

      // Update store state atomically
      const currentState = usePersistentChatStore.getState();
      const updatedChatRooms = currentState.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      // Update the store state directly
      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });

      log(`Updated store state for room ${chatRoomId}`, { totalRooms: updatedChatRooms.length });

      // Trigger immediate store synchronization and wait for completion
      await currentState.syncToStorage();

      // Double-check that the update was applied by getting fresh state
      const freshState = usePersistentChatStore.getState();
      const updatedRoom = freshState.chatRooms.find(room => room.id === chatRoomId);
      
      if (updatedRoom?.session?.sessionHandle === handle) {
        log(`✅ Successfully stored and verified session handle for room ${chatRoomId}`, { 
          handle: handle.substring(0, 16) + '...',
          timestamp: updatedRoom.session.lastConnected?.toISOString() || 'unknown',
          verification: 'passed'
        });
      } else {
        throw new Error(`Session handle verification failed for room ${chatRoomId}`);
      }
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

      // Update store state atomically
      const currentState = usePersistentChatStore.getState();
      const updatedChatRooms = currentState.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      // Update the store state
      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });

      // Trigger immediate store synchronization and wait for completion
      await store.syncToStorage();

      // Verify the clear operation
      const freshState = usePersistentChatStore.getState();
      const clearedRoom = freshState.chatRooms.find(room => room.id === chatRoomId);
      
      if (!clearedRoom?.session?.sessionHandle) {
        log(`✅ Successfully cleared session handle for room ${chatRoomId}`, { verification: 'passed' });
      } else {
        throw new Error(`Session handle clear verification failed for room ${chatRoomId}`);
      }
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