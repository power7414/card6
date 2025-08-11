import React, { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number; // 每個字符的顯示間隔（毫秒）
  onComplete?: () => void; // 打字完成時的回調
  className?: string;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speed = 30,
  onComplete,
  className = ''
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const previousTextRef = useRef('');

  useEffect(() => {
    // 檢查是否是全新的文字（完全不同的內容）
    const isNewText = !text.startsWith(previousTextRef.current) && !previousTextRef.current.startsWith(text);
    
    if (isNewText || text.length < displayedText.length) {
      // 完全重新開始
      setDisplayedText('');
      setCurrentIndex(0);
      previousTextRef.current = text;
    } else if (text.length > displayedText.length) {
      // 內容增加了，繼續從當前位置打字
      previousTextRef.current = text;
    }
  }, [text, displayedText.length]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.substring(0, currentIndex + 1));
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && text.length > 0 && displayedText === text) {
      // 打字完成
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete, displayedText]);

  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="typing-cursor">|</span>
      )}
    </span>
  );
};

export default TypewriterText;