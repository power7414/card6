import React, { useEffect, useState, useRef } from 'react';
import AudioPulse from '../audio-pulse/AudioPulse';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useChatManager } from '../../hooks/use-chat-manager';
import './conversation-audio-pulse.scss';

export const ConversationAudioPulse: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVolumeTimeRef = useRef<number>(0);
  const { client } = useLiveAPIContext();
  const { getActiveChatRoom } = useChatManager();
  const activeChatRoom = getActiveChatRoom();
  const streamingMessageRef = useRef<string | null>(null);
  const audioStreamActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (!client) return;

    console.log('🎵 設置 ConversationAudioPulse');

    // 計算音頻音量
    const calculateVolume = (audioData: ArrayBuffer): number => {
      const int16Array = new Int16Array(audioData);
      let sum = 0;
      
      for (let i = 0; i < int16Array.length; i++) {
        sum += Math.abs(int16Array[i]);
      }
      
      const average = sum / int16Array.length / 32768;
      return Math.min(average * 2, 1); // 標準化到 0-1
    };

    // 處理音頻數據
    const handleAudioData = (audioData: ArrayBuffer) => {
      console.log('🎶 [ConversationAudioPulse] 收到音頻數據:', audioData.byteLength);
      
      const vol = calculateVolume(audioData);
      const currentTime = Date.now();
      
      // 更新最後接收音頻的時間
      lastVolumeTimeRef.current = currentTime;
      audioStreamActiveRef.current = true;
      
      setVolume(vol);
      setIsActive(true);

      // 清除之前的計時器
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }

      // 設置短暫的計時器來維持動畫流暢度
      volumeTimeoutRef.current = setTimeout(() => {
        setVolume(0);
      }, 150);
      
      // 檢查音頻流是否結束 (如果沒有新的音頻數據超過一定時間)
      const checkAudioStreamEnd = () => {
        const now = Date.now();
        const timeSinceLastAudio = now - lastVolumeTimeRef.current;
        
        // 如果超過 500ms 沒有收到新的音頻數據，認為音頻流結束
        if (timeSinceLastAudio >= 500 && audioStreamActiveRef.current) {
          console.log('🔇 [ConversationAudioPulse] 音頻流結束 (基於時間檢測)');
          audioStreamActiveRef.current = false;
          setIsActive(false);
          setVolume(0);
          streamingMessageRef.current = null;
        } else if (audioStreamActiveRef.current) {
          // 繼續檢查
          setTimeout(checkAudioStreamEnd, 100);
        }
      };
      
      // 啟動音頻流結束檢測
      setTimeout(checkAudioStreamEnd, 100);
    };

    // 處理轉錄開始
    const handleTranscriptionStart = (transcription: any) => {
      if (transcription.text?.trim()) {
        console.log('🎤 [ConversationAudioPulse] 轉錄開始');
        setIsActive(true);
        
        // 找到當前正在串流的訊息
        if (activeChatRoom) {
          const streamingMsg = activeChatRoom.messages.find((msg: any) => msg.isTyping);
          if (streamingMsg) {
            streamingMessageRef.current = streamingMsg.id;
          }
        }
      }
    };

    // 處理回合結束
    const handleTurnComplete = () => {
      console.log('🏁 [ConversationAudioPulse] AI 回應完成');
      
      // 標記音頻流不再活躍
      audioStreamActiveRef.current = false;
      
      // 清除計時器
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
      
      // 檢查是否還有音頻在播放，如果沒有則立即停止視覺化
      const checkAndStop = () => {
        const now = Date.now();
        const timeSinceLastAudio = now - lastVolumeTimeRef.current;
        
        // 如果最近沒有音頻活動或者已經超過閾值時間，則立即停止
        if (timeSinceLastAudio >= 200 || !audioStreamActiveRef.current) {
          console.log('🔇 [ConversationAudioPulse] 停止顯示 (基於實際音頻狀態)');
          setIsActive(false);
          setVolume(0);
          streamingMessageRef.current = null;
        } else {
          // 稍等一下再檢查，以防還有剩餘音頻
          setTimeout(checkAndStop, 100);
        }
      };
      
      checkAndStop();
    };

    // 綁定事件
    client.on('audio', handleAudioData);
    client.on('output_transcription', handleTranscriptionStart);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('audio', handleAudioData);
      client.off('output_transcription', handleTranscriptionStart);
      client.off('turncomplete', handleTurnComplete);
      
      // 清除所有計時器
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
      
      // 重置狀態
      audioStreamActiveRef.current = false;
    };
  }, [client, activeChatRoom]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="conversation-audio-pulse">
      <AudioPulse 
        active={isActive}
        volume={volume}
        hover={false}
      />
    </div>
  );
};

export default ConversationAudioPulse;