import { useCallback, useMemo } from 'react';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useChatStore } from '../stores/chat-store';
import { useChatManager } from './use-chat-manager';
import { useUIStore } from '../stores/ui-store';

export function useConversation() {
  const { client, connected, connect, connectWithResumption } = useLiveAPIContext();
  const { addMessage } = useChatStore();
  const { activeChatRoom, getActiveChatRoom } = useChatManager();
  const { setShowWaveAnimation } = useUIStore();

  // Memoize message creation functions to prevent recreating objects
  const createUserMessage = useCallback((text: string) => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user' as const,
    content: text.trim(),
    timestamp: new Date()
  }), []);

  const createErrorMessage = useCallback((error: unknown) => ({
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'assistant' as const,
    content: `發送失敗: ${error instanceof Error ? error.message : '未知錯誤'}`,
    timestamp: new Date()
  }), []);

  // 發送文字訊息到 AI
  const sendTextMessage = useCallback(async (text: string) => {
    const activeRoom = getActiveChatRoom();
    if (!activeRoom || !text.trim()) return;

    // 添加用戶訊息到聊天記錄
    const userMessage = createUserMessage(text);
    addMessage(activeRoom.id, userMessage);

    try {
      // 確保 API 連接 (使用 session resumption)
      if (!connected) {
        await connectWithResumption(activeRoom.id);
      }

      // 發送訊息給 AI
      client.send({ text: text.trim() }, true);

      // 顯示 AI 正在回應的動畫
      setShowWaveAnimation(true);

    } catch (error) {
      console.error('發送訊息失敗:', error);
      
      // 添加錯誤訊息
      const errorMessage = createErrorMessage(error);
      addMessage(activeRoom.id, errorMessage);
    }
  }, [getActiveChatRoom, addMessage, client, connected, connectWithResumption, setShowWaveAnimation, createUserMessage, createErrorMessage]);

  // 發送語音數據到 AI (實時音頻輸入)
  const sendAudioData = useCallback(async (audioData: string) => {
    if (!activeChatRoom || !connected) return;

    try {
      // Audio format: Raw little-endian 16-bit PCM at 16kHz input
      client.sendRealtimeInput([{
        mimeType: 'audio/pcm;rate=16000;encoding=linear16',
        data: audioData
      }]);
    } catch (error) {
      console.error('發送音頻失敗:', error);
    }
  }, [activeChatRoom, client, connected]);

  // 發送實時輸入 (支持多種媒體類型)
  const sendRealtimeInput = useCallback(async (chunks: Array<{ mimeType: string; data: string }>) => {
    if (!activeChatRoom || !connected) {
      console.warn('Cannot send realtime input: Chat room not active or API not connected');
      return;
    }

    try {
      client.sendRealtimeInput(chunks);
    } catch (error) {
      console.error('發送實時輸入失敗:', error);
    }
  }, [activeChatRoom, client, connected]);

  // 發送音頻 blob (便利方法)
  const sendAudioBlob = useCallback(async (audioBlob: Blob) => {
    if (!activeChatRoom || !connected) return;

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binaryString);
      
      await sendRealtimeInput([{
        mimeType: 'audio/pcm;rate=16000;encoding=linear16',
        data: base64
      }]);
    } catch (error) {
      console.error('發送音頻 blob 失敗:', error);
    }
  }, [activeChatRoom, connected, sendRealtimeInput]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    sendTextMessage,
    sendAudioData,
    sendRealtimeInput,
    sendAudioBlob,
    connected
  }), [
    sendTextMessage,
    sendAudioData,
    sendRealtimeInput,
    sendAudioBlob,
    connected
  ]);
}