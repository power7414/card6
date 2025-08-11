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
  return (
    <div className={`wave-animation ${isActive ? 'active' : ''} ${className}`}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${i * 0.1}s`,
            height: isActive ? `${Math.max(4, volume * 30 + (i === 2 ? 20 : 10))}px` : '4px'
          }}
        />
      ))}
    </div>
  );
};