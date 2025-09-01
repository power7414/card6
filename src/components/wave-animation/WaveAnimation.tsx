import React from 'react';
import './wave-animation.scss';

interface WaveAnimationProps {
  isActive: boolean;
  volume?: number;
  className?: string;
}

export const WaveAnimation: React.FC<WaveAnimationProps> = ({ 
  isActive, 
  volume = 0,
  className = "" 
}) => {
  // 確保即使 volume 是 0，波形也有基本高度
  const getBarHeight = (index: number) => {
    if (!isActive) return 4;
    
    // 基礎高度
    const baseHeight = index === 2 ? 25 : 15; // 中間的 bar 較高
    // 根據 volume 添加額外高度
    const volumeHeight = volume * 20;
    // 添加一些隨機變化使動畫更生動
    const variation = Math.sin(Date.now() / 200 + index) * 5;
    
    return Math.max(8, baseHeight + volumeHeight + variation);
  };
  
  return (
    <div className={`wave-animation ${isActive ? 'active' : ''} ${className}`}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${i * 0.1}s`,
            height: `${getBarHeight(i)}px`
          }}
        />
      ))}
    </div>
  );
};