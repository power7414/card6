import { useCallback, useEffect, useMemo } from 'react';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { ChatRoom } from '../types/chat';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';

export function useChatManager() {
  const {
    chatRooms,
    activeChatRoom,
    isLoading,
    error,
    initialize,
    addChatRoom,
    setActiveChatRoom,
    deleteChatRoom,
    renameChatRoom,
    clearError
  } = usePersistentChatStore();
  
  const { connected, disconnect, connectWithResumption } = useLiveAPIContext();

  // Initialize the store when the hook is first used
  // Only call initialize once by using a ref to track initialization
  useEffect(() => {
    if (!isLoading && chatRooms.length === 0 && !error) {
      initialize();
    }
  }, []); // Empty dependency array is intentional - we only want to initialize once

  // Memoize next room number to prevent stale closures
  const nextRoomNumber = useMemo(() => chatRooms.length + 1, [chatRooms.length]);

  const createNewChatRoom = useCallback(async () => {
    const newChatRoom: ChatRoom = {
      id: `chatroom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      name: `對話 ${nextRoomNumber}`,
      messages: [],
      createdAt: new Date(),
      lastMessageAt: new Date(),
      isActive: true
    };
    
    try {
      await addChatRoom(newChatRoom);
      await setActiveChatRoom(newChatRoom.id);
      return newChatRoom.id;
    } catch (error) {
      console.error('Failed to create new chat room:', error);
      throw error;
    }
  }, [nextRoomNumber, addChatRoom, setActiveChatRoom]);

  const switchChatRoom = useCallback(async (chatRoomId: string) => {
    try {
      console.log('🔄 切換聊天室:', { from: activeChatRoom, to: chatRoomId, connected });
      
      // 如果是切換到同一個聊天室，跳過操作
      if (activeChatRoom === chatRoomId) {
        console.log('⚠️ 已經在目標聊天室中，跳過切換');
        return;
      }
      
      // 記錄原來的連接狀態
      const wasConnected = connected;
      
      // 如果目前有連接，斷開連接（這會觸發 session 保存）
      if (wasConnected) {
        console.log('📡 斷開當前連接並保存 session...');
        await disconnect();
        // 給一點時間讓 session 更新處理完成
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 切換到新聊天室
      await setActiveChatRoom(chatRoomId);
      console.log('✅ 已切換到聊天室:', chatRoomId);
      
      // 只有在明確斷開連接後才自動重連
      // 避免與手動連接競爭
      if (wasConnected) {
        console.log('🔌 等待用戶手動連接到新聊天室...');
        console.log('💡 提示：請點擊連接按鈕以連接到新聊天室');
        // 移除自動重連，讓用戶手動控制
        // try {
        //   await connectWithResumption(chatRoomId);
        //   console.log('✅ 自動連接成功');
        // } catch (error) {
        //   console.warn('⚠️ 自動連接失敗，需手動連接:', error);
        // }
      }
      
    } catch (error) {
      console.error('Failed to switch chat room:', error);
    }
  }, [setActiveChatRoom, connected, disconnect, activeChatRoom]);

  // Memoize active chat room lookup to prevent unnecessary recalculations
  const getActiveChatRoom = useMemo(() => {
    return chatRooms.find(room => room.id === activeChatRoom);
  }, [chatRooms, activeChatRoom]);

  const deleteChatRoomWithConfirm = useCallback(async (chatRoomId: string) => {
    const chatRoom = chatRooms.find(r => r.id === chatRoomId);
    if (!chatRoom) return;

    const confirmed = window.confirm(
      `確定要刪除「${chatRoom.name}」嗎？此操作無法恢復。`
    );
    
    if (confirmed) {
      try {
        await deleteChatRoom(chatRoomId);
        // 如果刪除的是當前聊天室，切換到最新的聊天室
        if (chatRoomId === activeChatRoom && chatRooms.length > 1) {
          const remainingRooms = chatRooms.filter(r => r.id !== chatRoomId);
          if (remainingRooms.length > 0) {
            await setActiveChatRoom(remainingRooms[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to delete chat room:', error);
        alert('刪除聊天室失敗，請稍後再試。');
      }
    }
  }, [chatRooms, activeChatRoom, deleteChatRoom, setActiveChatRoom]);

  const renameChatRoomWithPrompt = useCallback(async (chatRoomId: string) => {
    const chatRoom = chatRooms.find(r => r.id === chatRoomId);
    if (!chatRoom) return;

    const newName = window.prompt('請輸入新的聊天室名稱：', chatRoom.name);
    if (newName && newName.trim() !== '') {
      try {
        await renameChatRoom(chatRoomId, newName.trim());
      } catch (error) {
        console.error('Failed to rename chat room:', error);
        alert('重新命名聊天室失敗，請稍後再試。');
      }
    }
  }, [chatRooms, renameChatRoom]);

  return {
    chatRooms,
    activeChatRoom,
    getActiveChatRoom: () => getActiveChatRoom, // Return as function for consistency
    isLoading,
    error,
    createNewChatRoom,
    switchChatRoom,
    deleteChatRoomWithConfirm,
    renameChatRoomWithPrompt,
    clearError
  };
}