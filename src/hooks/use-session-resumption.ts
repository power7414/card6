/**
 * Session Resumption Hook - 符合官方標準
 * 
 * 管理每個聊天室的 session handle，實現連線中斷後的對話恢復
 * 支援自動過期檢查（音頻模式固定 15 分鐘）
 */

import { useCallback } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { ChatRoomSession } from '../types/chat';

// 常數定義
const MAX_SESSION_AGE = 15 * 60 * 1000; // 15 分鐘（音頻模式）

interface SessionResumptionUpdate {
  resumable: boolean;
  newHandle: string | null;
}

interface UseSessionResumptionOptions {
  enableLogging?: boolean;  // 預設: false
}

interface UseSessionResumptionReturn {
  // 官方標準 API
  storeSessionHandle: (chatRoomId: string, handle: string) => Promise<void>;
  getSessionHandle: (chatRoomId: string) => string | null;
  clearSessionHandle: (chatRoomId: string) => Promise<void>;
  hasValidSession: (chatRoomId: string) => boolean;
  cleanupExpiredSessions: (chatRoomId?: string) => Promise<void>;
  
  // 向後相容 API
  handleSessionResumptionUpdate: (chatRoomId: string, update: SessionResumptionUpdate) => Promise<void>;
  
  // 統計資訊
  getSessionStats: () => {
    totalSessions: number;
    roomsWithSessions: string[];
  };
}

export function useSessionResumption(options: UseSessionResumptionOptions = {}): UseSessionResumptionReturn {
  const { enableLogging = true } = options; // 啟用日誌來debug問題
  const { chatRooms } = usePersistentChatStore();
  
  // 簡單的 log 函數
  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[SessionResumption] ${message}`, data || '');
    }
  }, [enableLogging]);
  
  // 檢查 session 是否過期
  const isSessionExpired = useCallback((session: ChatRoomSession): boolean => {
    if (!session.lastConnected) return true;
    return Date.now() - session.lastConnected.getTime() > MAX_SESSION_AGE;
  }, []);

  // 取得聊天室的 session handle（含過期檢查）
  const getSessionHandle = useCallback((chatRoomId: string): string | null => {
    const chatRoom = chatRooms.find(room => room.id === chatRoomId);
    
    if (!chatRoom?.session?.sessionHandle) {
      log(`沒有找到 session handle: ${chatRoomId}`);
      return null;
    }

    // 檢查是否過期
    if (isSessionExpired(chatRoom.session)) {
      log(`Session handle 已過期: ${chatRoomId}`);
      return null;
    }

    log(`取得有效 session handle: ${chatRoomId}`, {
      handle: chatRoom.session.sessionHandle.substring(0, 16) + '...'
    });
    
    return chatRoom.session.sessionHandle;
  }, [chatRooms, log, isSessionExpired]);

  // 官方標準：儲存 session handle
  const storeSessionHandle = useCallback(async (chatRoomId: string, handle: string): Promise<void> => {
    try {
      log(`儲存 session handle: ${chatRoomId}`, { 
        handle: handle.substring(0, 16) + '...' 
      });
      
      const store = usePersistentChatStore.getState();
      const chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
      
      if (!chatRoom) {
        throw new Error(`找不到聊天室: ${chatRoomId}`);
      }

      // 建立新的 session 資料
      const updatedSession: ChatRoomSession = {
        sessionHandle: handle,
        lastConnected: new Date(),
        isResumable: true
      };

      // 更新聊天室
      const updatedChatRoom = {
        ...chatRoom,
        session: updatedSession
      };

      // 更新 store
      const updatedChatRooms = store.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });
      
      // 同步到儲存
      await store.syncToStorage();
      
      log(`✅ Session handle 儲存成功: ${chatRoomId}`);
    } catch (error) {
      console.error(`儲存 session handle 失敗: ${chatRoomId}`, error);
      throw error;
    }
  }, [log]);

  // 清除聊天室的 session handle
  const clearSessionHandle = useCallback(async (chatRoomId: string): Promise<void> => {
    try {
      log(`清除 session handle: ${chatRoomId}`);
      
      const store = usePersistentChatStore.getState();
      const chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
      
      if (!chatRoom) {
        log(`找不到聊天室，跳過清除: ${chatRoomId}`);
        return;
      }

      // 清除 session 資料
      const updatedChatRoom = {
        ...chatRoom,
        session: undefined
      };

      // 更新 store
      const updatedChatRooms = store.chatRooms.map(room => 
        room.id === chatRoomId ? updatedChatRoom : room
      );

      usePersistentChatStore.setState({ chatRooms: updatedChatRooms });
      
      // 同步到儲存
      await store.syncToStorage();
      
      log(`✅ Session handle 清除成功: ${chatRoomId}`);
    } catch (error) {
      console.error(`清除 session handle 失敗: ${chatRoomId}`, error);
      throw error;
    }
  }, [log]);
  
  // 官方標準：清理過期的 session（針對指定聊天室）
  const cleanupExpiredSessions = useCallback(async (targetChatRoomId?: string): Promise<void> => {
    try {
      const store = usePersistentChatStore.getState();
      const activeChatRoom = targetChatRoomId || store.activeChatRoom;
      
      if (!activeChatRoom) {
        log('沒有指定聊天室，跳過清理');
        return;
      }
      
      const chatRoom = store.chatRooms.find(room => room.id === activeChatRoom);
      if (!chatRoom?.session) {
        log(`聊天室沒有 session，跳過清理: ${activeChatRoom}`);
        return;
      }
      
      if (isSessionExpired(chatRoom.session)) {
        log(`清理過期 session: ${activeChatRoom}`);
        await clearSessionHandle(activeChatRoom);
      } else {
        log(`Session 仍有效，無需清理: ${activeChatRoom}`);
      }
    } catch (error) {
      console.error('清理過期 session 失敗:', error);
    }
  }, [log, isSessionExpired, clearSessionHandle]);

  // 檢查聊天室是否有有效的 session（含過期檢查）
  const hasValidSession = useCallback((chatRoomId: string): boolean => {
    const chatRoom = chatRooms.find(room => room.id === chatRoomId);
    
    if (!chatRoom?.session?.sessionHandle || !chatRoom.session.isResumable) {
      log(`Session 不存在: ${chatRoomId}`);
      return false;
    }
    
    // 檢查是否過期
    if (isSessionExpired(chatRoom.session)) {
      log(`Session 已過期: ${chatRoomId}`);
      return false;
    }
    
    log(`Session 有效: ${chatRoomId}`);
    return true;
  }, [chatRooms, log, isSessionExpired]);

  // 向後相容：處理 Live API 的 session resumption 更新
  const handleSessionResumptionUpdate = useCallback(async (chatRoomId: string, update: SessionResumptionUpdate): Promise<void> => {
    try {
      console.log(`🔄 [SessionResumption] 收到更新:`, {
        chatRoomId,
        resumable: update.resumable,
        newHandle: update.newHandle ? update.newHandle.substring(0, 16) + '...' : null,
        hasNewHandle: !!update.newHandle
      });
      
      if (update.resumable && update.newHandle) {
        // 使用官方標準 API
        log(`✅ Session 可恢復，儲存新 handle: ${chatRoomId}`);
        await storeSessionHandle(chatRoomId, update.newHandle);
      } else if (update.resumable === false && update.newHandle === null) {
        // 只有在明確收到 resumable: false 且沒有 newHandle 時才清除
        // 這可能表示 session 真的失效了
        console.log(`❌ [SessionResumption] Session 明確不可恢復，清除 handle:`, {
          resumable: update.resumable,
          newHandle: update.newHandle,
          chatRoomId
        });
        log(`Session 不可恢復，清除 handle: ${chatRoomId}`);
        await clearSessionHandle(chatRoomId);
      } else {
        // 其他情況下保留現有 handle，可能是中間狀態
        console.log(`⚠️ [SessionResumption] 收到模糊的狀態更新，保留現有 handle:`, {
          resumable: update.resumable,
          hasNewHandle: !!update.newHandle,
          chatRoomId
        });
      }
    } catch (error) {
      console.error(`處理 session resumption 更新失敗: ${chatRoomId}`, error);
      // 不要拋出錯誤，這樣不會影響其他功能
    }
  }, [log, storeSessionHandle, clearSessionHandle]);

  // 取得統計資訊
  const getSessionStats = useCallback(() => {
    const roomsWithSessions = chatRooms
      .filter(room => room.session?.sessionHandle)
      .map(room => room.id);
    
    return {
      totalSessions: roomsWithSessions.length,
      roomsWithSessions
    };
  }, [chatRooms]);

  return {
    // 官方標準 API
    storeSessionHandle,
    getSessionHandle,
    clearSessionHandle,
    hasValidSession,
    cleanupExpiredSessions,
    
    // 向後相容 API
    handleSessionResumptionUpdate,
    
    // 統計資訊
    getSessionStats,
  };
}