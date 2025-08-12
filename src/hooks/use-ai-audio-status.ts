import { useState, useEffect, useRef } from 'react';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useChatManager } from './use-chat-manager';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { Message } from '../types/chat';

/**
 * Hook 用於檢測 AI 語音播放狀態和音量
 */
export function useAIAudioStatus() {
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [volume, setVolume] = useState(0);
  const { client } = useLiveAPIContext();
  const { activeChatRoom } = useChatManager();
  const { chatRooms } = usePersistentChatStore();

  // console.log('🎯 useAIAudioStatus Hook 初始化', {
  //   hasClient: !!client,
  //   activeChatRoom,
  //   chatRoomsCount: chatRooms.length
  // });
  
  // 追蹤當前 AI 回應狀態
  const isAIRespondingRef = useRef(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 檢查是否有正在打字的 AI 訊息
  const currentChatRoom = activeChatRoom ? chatRooms.find(room => room.id === activeChatRoom) : null;
  const hasTypingAIMessage = currentChatRoom 
    ? currentChatRoom.messages.some((msg: Message) => msg.type === 'assistant' && msg.isTyping)
    : false;

  // console.log('🔍 訊息狀態檢查:', {
  //   activeChatRoom,
  //   currentChatRoomExists: !!currentChatRoom,
  //   messagesCount: currentChatRoom?.messages.length || 0,
  //   hasTypingAIMessage,
  //   typingMessages: currentChatRoom?.messages.filter((msg: Message) => msg.type === 'assistant' && msg.isTyping).length || 0
  // });

  useEffect(() => {
    // console.log('🎯 useAIAudioStatus useEffect 執行', { hasClient: !!client });
    if (!client) {
      // console.log('❌ 沒有 client，退出 useEffect');
      return;
    }

    // 監聽音頻事件 - 當收到音頻數據時表示 AI 正在說話
    const handleAudio = (data: ArrayBuffer) => {
      // console.log('🎵 useAIAudioStatus: 收到音頻數據', {
      //   byteLength: data.byteLength,
      //   isAIPlaying: isAIRespondingRef.current
      // });

      if (data.byteLength > 0) {
        setIsAIPlaying(true);
        isAIRespondingRef.current = true;

        // 計算音量 (簡化的音量檢測)
        const audioData = new Uint8Array(data);
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
          sum += Math.abs(audioData[i] - 128); // PCM16 中性值為 128
        }
        const avgVolume = sum / audioData.length / 128; // 標準化到 0-1
        const finalVolume = Math.min(avgVolume, 1);
        setVolume(finalVolume);

        // console.log('📊 音量計算:', { avgVolume, finalVolume });

        // 清除之前的計時器
        if (volumeTimeoutRef.current) {
          clearTimeout(volumeTimeoutRef.current);
        }

        // 設置計時器，如果一段時間沒有收到音頻數據就停止播放狀態
        volumeTimeoutRef.current = setTimeout(() => {
          // console.log('⏹️ 音頻超時，停止播放狀態');
          setIsAIPlaying(false);
          setVolume(0);
          isAIRespondingRef.current = false;
        }, 500); // 500ms 沒有音頻數據就認為停止播放
      }
    };

    // 監聽對話完成事件
    const handleTurnComplete = () => {
      // 延遲一點停止，讓最後的音頻播放完成
      setTimeout(() => {
        setIsAIPlaying(false);
        setVolume(0);
        isAIRespondingRef.current = false;
        
        if (volumeTimeoutRef.current) {
          clearTimeout(volumeTimeoutRef.current);
          volumeTimeoutRef.current = null;
        }
      }, 200);
    };

    // 監聽轉錄事件 - 當收到轉錄時表示 AI 正在說話
    const handleOutputTranscription = (transcription: any) => {
      // console.log('🎤 useAIAudioStatus: 收到轉錄事件', {
      //   text: transcription.text,
      //   isFinal: transcription.isFinal,
      //   textLength: transcription.text?.length || 0
      // });

      if (transcription.text && !transcription.isFinal) {
        setIsAIPlaying(true);
        isAIRespondingRef.current = true;
        // 根據文字長度模擬音量
        const textLength = transcription.text.length;
        const simulatedVolume = Math.min(textLength / 50, 1);
        const finalVolume = simulatedVolume * 0.7; // 降低一點避免過於強烈
        setVolume(finalVolume);
        
        // console.log('📊 轉錄音量模擬:', { textLength, simulatedVolume, finalVolume });
      }
    };

    client.on('audio', handleAudio);
    client.on('turncomplete', handleTurnComplete);
    client.on('output_transcription', handleOutputTranscription);

    return () => {
      client.off('audio', handleAudio);
      client.off('turncomplete', handleTurnComplete);
      client.off('output_transcription', handleOutputTranscription);
      
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, [client]);

  // 當沒有打字中的 AI 訊息時，重置狀態
  useEffect(() => {
    if (!hasTypingAIMessage && !isAIRespondingRef.current) {
      setIsAIPlaying(false);
      setVolume(0);
    }
  }, [hasTypingAIMessage]);

  // console.log('🎪 最終返回狀態:', {
  //   isAIPlaying,
  //   volume,
  //   hasTypingAIMessage,
  //   finalIsAIPlaying: isAIPlaying // 只使用實際的播放狀態，不再依賴 hasTypingAIMessage
  // });

  return {
    isAIPlaying: isAIPlaying, // 移除 hasTypingAIMessage 的依賴
    volume,
    hasTypingAIMessage
  };
}