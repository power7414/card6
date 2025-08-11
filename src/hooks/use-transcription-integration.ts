/**
 * 整合 Live API 轉錄事件和 useTranscription hook
 * 同時處理用戶輸入轉錄顯示在對話框中
 */

import { useEffect, useRef } from 'react';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useTranscription } from './use-transcription';
import { useChatStore } from '../stores/chat-store';
import { useChatManager } from './use-chat-manager';

export function useTranscriptionIntegration() {
  console.log('🚀 useTranscriptionIntegration hook 開始執行');
  const { client } = useLiveAPIContext();
  const { 
    setInputTranscriptionDirect
  } = useTranscription();
  const { addMessage, updateMessage } = useChatStore();
  const { activeChatRoom } = useChatManager();
  
  // 追蹤當前用戶語音訊息的 ID
  const currentUserMessageRef = useRef<string | null>(null);
  
  // 創建用戶訊息的輔助函數
  const createUserMessage = (text: string, isTyping: boolean = true) => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user' as const,
    content: text,
    timestamp: new Date(),
    isTyping
  });

  useEffect(() => {
    console.log('🔧 useTranscriptionIntegration useEffect 執行, client:', client ? 'exists' : 'null');
    if (!client) {
      console.log('❌ client 為 null，無法註冊轉錄事件監聽器');
      return;
    }

    // 處理用戶語音輸入轉錄事件
    const onInputTranscription = (data: { text: string; isFinal?: boolean }) => {
      console.log('🎤 input_transcription 事件被觸發! data:', data, 'activeChatRoom:', activeChatRoom);
      
      const transcriptionText = data.text?.trim();
      if (transcriptionText) {
        console.log('🎤 收到用戶語音轉錄事件:', {
          text: data.text,
          isFinal: data.isFinal,
          textLength: data.text?.length || 0,
          currentMessageId: currentUserMessageRef.current,
          activeChatRoom: activeChatRoom
        });

        // 1. 先更新 useTranscription 狀態（無論是否有活動聊天室）
        setInputTranscriptionDirect(transcriptionText, data.isFinal ?? false);
        
        // 2. 只有在有活動聊天室時才顯示在對話框中
        if (!activeChatRoom) {
          console.log('⚠️ 沒有活動聊天室，跳過對話框顯示，但轉錄狀態已更新');
          return;
        }
        
        // 3. 將轉錄顯示在對話框中
        if (!currentUserMessageRef.current) {
          // 創建新的用戶語音訊息
          const userMessage = createUserMessage(transcriptionText, !data.isFinal);
          currentUserMessageRef.current = userMessage.id;
          console.log('✨ 創建新的用戶語音訊息:', {
            id: userMessage.id,
            content: transcriptionText.substring(0, 50) + '...'
          });
          addMessage(activeChatRoom, userMessage);
        } else {
          // 更新現有的用戶語音訊息
          console.log('📝 更新現有用戶語音訊息:', currentUserMessageRef.current);
          updateMessage?.(activeChatRoom, currentUserMessageRef.current, (msg) => {
            console.log('🔄 用戶轉錄內容更新:', {
              oldContent: msg.content.substring(0, 30) + '...',
              newContent: transcriptionText.substring(0, 30) + '...',
              oldLength: msg.content.length,
              newLength: transcriptionText.length,
              isFinal: data.isFinal
            });
            return { 
              ...msg, 
              content: transcriptionText, 
              isTyping: !data.isFinal 
            };
          });
        }
        
        // 當轉錄完成時，重置當前訊息 ID
        if (data.isFinal) {
          console.log('✅ 用戶語音轉錄完成，重置訊息 ID');
          currentUserMessageRef.current = null;
        }
      }
    };

    // AI 語音輸出轉錄已經由 useConversationEvents 處理
    // 這裡不需要重複處理，避免創建重複訊息

    // 處理 turnComplete 事件 - 重置用戶訊息追蹤
    const onTurnComplete = () => {
      console.log('🔄 AI 回應完成，重置用戶訊息追蹤');
      currentUserMessageRef.current = null;
    };

    // 註冊事件監聽器 (只處理 input_transcription，output_transcription 由 useConversationEvents 處理)
    client.on('input_transcription', onInputTranscription);
    client.on('turncomplete', onTurnComplete);

    console.log('🔗 轉錄事件監聽器已註冊');

    return () => {
      console.log('🧹 清理轉錄事件監聽器');
      client.off('input_transcription', onInputTranscription);
      client.off('turncomplete', onTurnComplete);
    };
  }, [client, setInputTranscriptionDirect, activeChatRoom, addMessage, updateMessage]);

  // 這個 hook 不需要返回任何東西，它只是負責整合事件
  return {};
}