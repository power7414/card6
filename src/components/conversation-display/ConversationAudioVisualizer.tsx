import React, { useEffect, useRef, useState } from 'react';
import { LiveAudioVisualizer } from 'react-audio-visualize';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './conversation-audio-visualizer.scss';

export const ConversationAudioVisualizer: React.FC = () => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [hasActiveAudio, setHasActiveAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { client } = useLiveAPIContext();

  // 設置音頻視覺化
  useEffect(() => {
    const setupAudioVisualization = async () => {
      try {
        console.log('🎵 設置對話背景音頻視覺化');
        
        // 創建音頻上下文
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // 創建分析器節點
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;

        // 創建增益節點用於控制音量
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // 設置初始音量
        gainNodeRef.current = gainNode;

        // 連接節點：gainNode -> analyser -> destination
        gainNode.connect(analyser);
        
        // 創建 MediaStreamDestination
        const destination = audioContext.createMediaStreamDestination();
        analyser.connect(destination);
        
        const stream = destination.stream;
        mediaStreamRef.current = stream;

        // 檢查音軌
        console.log('🎙️ MediaStream 音軌:', stream.getAudioTracks());

        // 創建 MediaRecorder
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        // 監聽 MediaRecorder 事件
        recorder.ondataavailable = (event) => {
          console.log('📊 MediaRecorder 數據可用:', event.data.size);
        };
        
        recorder.onstart = () => {
          console.log('🎬 MediaRecorder 已啟動');
        };
        
        recorder.onerror = (event) => {
          console.error('❌ MediaRecorder 錯誤:', event);
        };
        
        // 啟動錄音以激活視覺化
        recorder.start(100); // 每 100ms 觸發一次 dataavailable
        setMediaRecorder(recorder);

        console.log('✅ 對話背景音頻視覺化設置完成', {
          state: recorder.state,
          stream: stream.active,
          audioTracks: stream.getAudioTracks().length
        });

      } catch (error) {
        console.error('❌ 設置對話背景音頻視覺化失敗:', error);
      }
    };

    setupAudioVisualization();

    return () => {
      // 清理資源
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, []);

  // 監聽 Live API 音頻事件
  useEffect(() => {
    if (!client || !gainNodeRef.current || !audioContextRef.current) return;

    console.log('🎧 設置對話背景 Live API 音頻監聽');

    const handleAudioData = (audioData: ArrayBuffer) => {
      if (!gainNodeRef.current || !audioContextRef.current) return;

      console.log('🎶 對話背景收到音頻數據，長度:', audioData.byteLength);

      // 有音頻數據時顯示視覺化器
      setHasActiveAudio(true);
      
      // 清除之前的計時器
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }

      // 設置計時器，音頻停止後隱藏視覺化器
      audioTimeoutRef.current = setTimeout(() => {
        console.log('🔇 音頻停止，隱藏對話背景視覺化器');
        setHasActiveAudio(false);
      }, 300); // 300ms 沒有音頻數據就隱藏

      try {
        // 將 PCM16 數據轉換為 Float32Array
        const int16Array = new Int16Array(audioData);
        const float32Array = new Float32Array(int16Array.length);
        
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        // 創建音頻緩衝區
        const audioBuffer = audioContextRef.current.createBuffer(
          1, // 單聲道
          float32Array.length,
          24000 // 24kHz 採樣率
        );
        
        audioBuffer.copyToChannel(float32Array, 0);

        // 創建音頻源並播放
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        
        // 設置音量用於視覺化
        gainNodeRef.current.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
        
        source.start();
        
        // 監控音頻級別
        console.log('🔊 播放音頻片段，音量:', 0.5);

      } catch (error) {
        console.error('❌ 對話背景處理音頻數據錯誤:', error);
      }
    };

    client.on('audio', handleAudioData);

    return () => {
      client.off('audio', handleAudioData);
    };
  }, [client]);

  // 只在有音頻活動時渲染視覺化器
  if (!hasActiveAudio || !mediaRecorder) {
    return null;
  }

  return (
    <div className="conversation-audio-visualizer">
      <LiveAudioVisualizer
        mediaRecorder={mediaRecorder}
        width={400}
        height={60}
        barWidth={2}
        gap={1}
        backgroundColor="transparent"
        barColor="rgba(255, 255, 255, 0.3)"
        fftSize={512}
        maxDecibels={-20}
        minDecibels={-80}
        smoothingTimeConstant={0.6}
      />
    </div>
  );
};

export default ConversationAudioVisualizer;