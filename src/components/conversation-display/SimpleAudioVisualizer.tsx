import React, { useEffect, useRef, useState } from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import './simple-audio-visualizer.scss';

export const SimpleAudioVisualizer: React.FC = () => {
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const [isActive, setIsActive] = useState(false);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { client } = useLiveAPIContext();
  
  console.log('🎨 SimpleAudioVisualizer 組件渲染', {
    isActive,
    hasClient: !!client,
    audioLevelsMax: Math.max(...audioLevels).toFixed(3)
  });

  // 處理音頻數據並計算音量級別
  const processAudioData = (audioData: ArrayBuffer) => {
    const int16Array = new Int16Array(audioData);
    const sampleSize = Math.floor(int16Array.length / 20);
    const levels: number[] = [];

    // 將音頻數據分成 20 個段，計算每段的平均音量
    for (let i = 0; i < 20; i++) {
      let sum = 0;
      const start = i * sampleSize;
      const end = Math.min(start + sampleSize, int16Array.length);
      
      for (let j = start; j < end; j++) {
        sum += Math.abs(int16Array[j]);
      }
      
      const average = sum / (end - start) / 32768; // 標準化到 0-1
      levels.push(Math.min(average * 3, 1)); // 放大信號但限制在 1
    }

    return levels;
  };

  // 平滑動畫更新
  const updateVisualizer = (newLevels: number[]) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const animate = () => {
      setAudioLevels(prevLevels => 
        prevLevels.map((level, i) => {
          const target = newLevels[i];
          const diff = target - level;
          return level + diff * 0.3; // 平滑過渡
        })
      );

      if (newLevels.some(level => level > 0.01)) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // 測試模式 - 產生隨機音頻級別來測試視覺化效果
  useEffect(() => {
    const testMode = false; // 確實關閉測試模式
    
    if (testMode) {
      console.log('🧪 視覺化器測試模式啟動');
      
      const testInterval = setInterval(() => {
        // 產生隨機音頻級別
        const testLevels = Array.from({ length: 20 }, () => Math.random() * 0.8);
        console.log('🧪 測試音頻級別:', testLevels.map(l => l.toFixed(2)));
        
        updateVisualizer(testLevels);
        setIsActive(true);
        
        // 隨機決定是否停止
        if (Math.random() > 0.9) {
          setIsActive(false);
          updateVisualizer(new Array(20).fill(0));
        }
      }, 100);
      
      return () => clearInterval(testInterval);
    }
    
    if (!client) {
      console.log('❌ 沒有 client，無法設置音頻監聽');
      return;
    }

    console.log('🎵 設置簡單音頻視覺化器', {
      hasClient: !!client,
      clientType: client?.constructor?.name || 'unknown',
      clientMethods: Object.getOwnPropertyNames(client || {}).filter(name => typeof (client as any)[name] === 'function')
    });

    const handleAudioData = (audioData: ArrayBuffer) => {
      console.log('🎶 [SimpleAudioVisualizer] 收到音頻數據！長度:', audioData.byteLength);

      // 處理音頻數據
      const levels = processAudioData(audioData);
      const maxLevel = Math.max(...levels);
      
      console.log('📊 音頻級別:', {
        max: maxLevel.toFixed(3),
        avg: (levels.reduce((a, b) => a + b) / levels.length).toFixed(3),
        levels: levels.map(l => l.toFixed(2))
      });

      // 更新視覺化
      updateVisualizer(levels);
      setIsActive(true);
      
      // 注意：不再設置短暫的 timeout，改為等待 turnComplete 事件
    };

    // 綁定音頻事件
    console.log('🔗 SimpleAudioVisualizer 綁定音頻事件');
    
    const handleAudioEvent = (audioData: ArrayBuffer) => {
      console.log('🎶 [SimpleAudioVisualizer] 收到音頻事件！', {
        byteLength: audioData.byteLength,
        constructor: audioData.constructor.name
      });
      handleAudioData(audioData);
    };
    
    const handleTurnComplete = () => {
      console.log('🏁 [SimpleAudioVisualizer] AI 回應完成，準備停止視覺化器');
      
      // 清除之前的計時器
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      
      // 延遲一段時間再隱藏，讓最後的音頻片段播放完
      audioTimeoutRef.current = setTimeout(() => {
        console.log('🔇 [SimpleAudioVisualizer] turnComplete 後停止視覺化器');
        setIsActive(false);
        updateVisualizer(new Array(20).fill(0));
      }, 1000); // 給 1 秒時間讓最後的音頻播放完
    };
    
    client.on('audio', handleAudioEvent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      console.log('🔌 [SimpleAudioVisualizer] 解綁所有事件');
      client.off('audio', handleAudioEvent);
      client.off('turncomplete', handleTurnComplete);
      
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [client]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="simple-audio-visualizer">
      <div className="visualizer-bars">
        {audioLevels.map((level, index) => (
          <div
            key={index}
            className="bar"
            style={{
              height: `${Math.max(5, level * 100)}%`,
              animationDelay: `${index * 0.02}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SimpleAudioVisualizer;