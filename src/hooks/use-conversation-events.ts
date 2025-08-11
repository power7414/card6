import { useCallback, useEffect, useRef } from 'react';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useChatStore } from '../stores/chat-store';
import { useChatManager } from './use-chat-manager';
import { useUIStore } from '../stores/ui-store';

/**
 * 專門處理 Live API 事件的 Hook
 * 這個 Hook 應該只在 App 層級使用一次，避免重複的事件監聽器
 */
export function useConversationEvents() {
  console.log('🚀 useConversationEvents Hook 開始執行');
  
  const { client } = useLiveAPIContext();
  const { addMessage, updateMessage } = useChatStore();
  const { activeChatRoom } = useChatManager();
  const { setShowWaveAnimation, setCurrentVolume } = useUIStore();

  console.log('🔍 Hook 狀態檢查:', {
    hasClient: !!client,
    activeChatRoom: activeChatRoom,
    hasAddMessage: !!addMessage,
    hasUpdateMessage: !!updateMessage
  });

  // 追蹤目前的 AI 回應訊息 ID 和累積的轉錄內容
  const currentAiMessageRef = useRef<string | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  // 創建助理訊息的輔助函數
  const createAssistantMessage = useCallback((content: string, isTyping = false) => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'assistant' as const,
    content,
    timestamp: new Date(),
    isTyping
  }), []);

  // 監聽聊天室切換，重置 AI 回應狀態
  useEffect(() => {
    // 當切換到不同聊天室時，重置 AI 回應狀態
    currentAiMessageRef.current = null;
    accumulatedTranscriptRef.current = '';
    setShowWaveAnimation(false);
    setCurrentVolume(0);
  }, [activeChatRoom, setShowWaveAnimation, setCurrentVolume]);

  // 訂閱 Live API 的事件
  useEffect(() => {
    console.log('📡 useEffect 開始執行，client:', !!client);
    if (!client) {
      console.log('❌ 沒有 client，退出 useEffect');
      return;
    }
    
    console.log('設置 Live API 事件監聽器');
    
    // 測試事件監聽器設置
    console.log('Client 對象:', client);
    console.log('Client 事件方法:', {
      hasOn: typeof client.on === 'function',
      hasOff: typeof client.off === 'function'
    });
    
    // 處理 Live API content 事件（主要用於文字模式的向後相容）
    const stableHandleAIResponse = (content: any) => {
      if (!activeChatRoom) return;

      console.log('收到 Live API content 事件:', {
        hasModelTurn: !!content.modelTurn,
        currentMessageId: currentAiMessageRef.current,
        activeChatRoom: activeChatRoom
      });

      // 處理文字模式的回應（向後相容）
      let responseText = '';
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }

      if (responseText.trim()) {
        const fullContent = responseText.trim();
        
        console.log('處理 AI 文字回應:', {
          contentLength: fullContent.length,
          hasCurrentMessage: !!currentAiMessageRef.current,
          content: fullContent.substring(0, 50) + '...'
        });

        if (!currentAiMessageRef.current) {
          const aiMessage = createAssistantMessage(fullContent, true);
          currentAiMessageRef.current = aiMessage.id;
          console.log('創建新的 AI 文字訊息:', aiMessage.id);
          addMessage(activeChatRoom, aiMessage);
        } else {
          updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => {
            if (msg.content !== fullContent) {
              console.log('文字內容有變化，更新訊息:', {
                oldLength: msg.content.length,
                newLength: fullContent.length
              });
              return { ...msg, content: fullContent, isTyping: true };
            }
            return msg;
          });
        }
      }
    };

    const stableHandleTurnComplete = () => {
      console.log('AI 回應完成，關閉打字狀態:', {
        messageId: currentAiMessageRef.current,
        activeChatRoom: activeChatRoom
      });
      
      // 停止波浪動畫
      setShowWaveAnimation(false);
      setCurrentVolume(0);
      
      // 將當前 AI 訊息設為非打字狀態
      if (currentAiMessageRef.current && activeChatRoom) {
        updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => ({
          ...msg,
          isTyping: false
        }));
      }
      
      // 重置當前 AI 訊息 ID 和累積器，準備下次對話
      currentAiMessageRef.current = null;
      accumulatedTranscriptRef.current = '';
    };
    
    // 處理語音轉錄事件 - Live API 發送增量片段，需要手動累積
    const stableHandleOutputTranscription = (transcription: any) => {
      if (!activeChatRoom) return;

      console.log('🎤 收到語音轉錄事件:', {
        text: transcription.text,
        isFinal: transcription.isFinal,
        textLength: transcription.text?.length || 0,
        currentMessageId: currentAiMessageRef.current,
        activeChatRoom: activeChatRoom
      });

      const newFragment = transcription.text?.trim();
      if (newFragment) {
        // 開始新回應時重置累積器
        if (!currentAiMessageRef.current) {
          accumulatedTranscriptRef.current = newFragment;
        } else {
          // 累積新片段
          accumulatedTranscriptRef.current += newFragment;
        }
        
        const fullTranscript = accumulatedTranscriptRef.current;
        
        console.log('📝 累積轉錄片段:', {
          newFragment: newFragment,
          fullTranscript: fullTranscript.substring(0, 50) + '...',
          transcriptLength: fullTranscript.length,
          isFinal: transcription.isFinal,
          hasCurrentMessage: !!currentAiMessageRef.current
        });

        if (!currentAiMessageRef.current) {
          // 創建新的 AI 訊息，使用累積的內容
          const aiMessage = createAssistantMessage(fullTranscript, true);
          currentAiMessageRef.current = aiMessage.id;
          console.log('✨ 創建新的 AI 語音訊息:', {
            id: aiMessage.id,
            content: fullTranscript.substring(0, 50) + '...'
          });
          addMessage(activeChatRoom, aiMessage);
        } else {
          // 更新現有的 AI 訊息，使用累積的完整內容
          console.log('📝 更新現有 AI 語音訊息:', currentAiMessageRef.current);
          updateMessage?.(activeChatRoom, currentAiMessageRef.current, (msg) => {
            console.log('🔄 轉錄內容更新:', {
              oldContent: msg.content.substring(0, 30) + '...',
              newContent: fullTranscript.substring(0, 30) + '...',
              oldLength: msg.content.length,
              newLength: fullTranscript.length,
              isFinal: transcription.isFinal
            });
            return { 
              ...msg, 
              content: fullTranscript, // 使用累積的完整內容
              isTyping: !transcription.isFinal 
            };
          });
        }
      }
    };

    client.on('content', stableHandleAIResponse);
    client.on('output_transcription', stableHandleOutputTranscription);
    client.on('turncomplete', stableHandleTurnComplete);
    
    return () => {
      console.log('清理 Live API 事件監聽器');
      client.off('content', stableHandleAIResponse);
      client.off('output_transcription', stableHandleOutputTranscription);
      client.off('turncomplete', stableHandleTurnComplete);
    };
  }, [client, activeChatRoom, addMessage, updateMessage, createAssistantMessage, setShowWaveAnimation, setCurrentVolume]);

  // 當新的文字訊息發送時，重置 AI 回應狀態
  const resetAIResponseState = useCallback(() => {
    console.log('🔄 重置 AI 回應狀態');
    currentAiMessageRef.current = null;
    accumulatedTranscriptRef.current = '';
  }, []);

  return {
    resetAIResponseState
  };
}