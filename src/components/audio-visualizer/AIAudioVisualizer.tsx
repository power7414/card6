import React, { useEffect, useRef, useState } from 'react';
import { LiveAudioVisualizer } from 'react-audio-visualize';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './ai-audio-visualizer.scss';

interface AIAudioVisualizerProps {
  /** 是否正在播放 AI 語音 */
  isAIPlaying?: boolean;
  /** 音量級別 (0-1) */
  volume?: number;
  /** 視覺化器寬度 */
  width?: number;
  /** 視覺化器高度 */
  height?: number;
  /** 是否顯示狀態文字 */
  showStatus?: boolean;
}

export const AIAudioVisualizer: React.FC<AIAudioVisualizerProps> = ({
  isAIPlaying = false,
  volume = 0,
  width = 200,
  height = 40,
  showStatus = true
}) => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioDataRef = useRef<Float32Array | null>(null);
  const { client } = useLiveAPIContext();

  // 設置音頻視覺化
  useEffect(() => {
    const setupAudioVisualization = async () => {
      try {
        console.log('🎵 設置 AI 音頻視覺化');
        
        // 創建音頻上下文
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // 創建分析器節點
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        analyser.maxDecibels = -10;
        analyser.minDecibels = -90;
        analyserRef.current = analyser;

        // 創建增益節點用於控制音量
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNodeRef.current = gainNode;

        // 創建 MediaStreamDestination
        const destination = audioContext.createMediaStreamDestination();
        gainNode.connect(destination);
        gainNode.connect(analyser);
        
        const stream = destination.stream;
        mediaStreamRef.current = stream;

        // 創建 MediaRecorder
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        // 啟動錄音以激活視覺化
        recorder.start();
        setMediaRecorder(recorder);

        console.log('✅ 音頻視覺化設置完成');

      } catch (error) {
        console.error('❌ 設置音頻視覺化失敗:', error);
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
    };
  }, []);

  // 監聽 Live API 音頻事件並注入到視覺化器
  useEffect(() => {
    if (!client || !gainNodeRef.current || !audioContextRef.current) return;

    console.log('🎧 設置 Live API 音頻監聽');

    const handleAudioData = (audioData: ArrayBuffer) => {
      if (!gainNodeRef.current || !audioContextRef.current) return;

      console.log('🎶 收到音頻數據，長度:', audioData.byteLength);

      try {
        // 將 PCM16 數據轉換為 Float32Array
        const int16Array = new Int16Array(audioData);
        const float32Array = new Float32Array(int16Array.length);
        
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0; // 轉換到 -1.0 到 1.0 範圍
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
        
        // 設置適當的音量
        const targetGain = isAIPlaying ? 0.3 : 0;
        gainNodeRef.current.gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
        
        source.start();

      } catch (error) {
        console.error('❌ 處理音頻數據錯誤:', error);
      }
    };

    client.on('audio', handleAudioData);

    return () => {
      client.off('audio', handleAudioData);
    };
  }, [client, isAIPlaying]);

  return (
    <div className={`ai-audio-visualizer ${isAIPlaying ? 'playing' : 'idle'}`}>
      {showStatus && (
        <div className="visualizer-status">
          {isAIPlaying ? (
            <span className="status-text playing">
              🎵 AI 語音播放中
            </span>
          ) : (
            <span className="status-text idle">
              🔇 等待 AI 回應
            </span>
          )}
        </div>
      )}
      
      <div className="visualizer-container">
        {mediaRecorder ? (
          <LiveAudioVisualizer
            mediaRecorder={mediaRecorder}
            width={width}
            height={height}
            barWidth={2}
            gap={1}
            backgroundColor="transparent"
            barColor={isAIPlaying ? "rgb(34, 197, 94)" : "rgb(107, 114, 128)"}
            fftSize={1024}
            maxDecibels={-10}
            minDecibels={-90}
            smoothingTimeConstant={0.4}
          />
        ) : (
          <div className="visualizer-placeholder" style={{ width, height }}>
            <div className="loading-bars">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="loading-bar"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    backgroundColor: isAIPlaying ? "rgb(34, 197, 94)" : "rgb(107, 114, 128)"
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAudioVisualizer;