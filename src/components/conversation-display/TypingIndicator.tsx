import React from 'react';
import { FiCpu, FiVolumeX, FiVolume2 } from 'react-icons/fi';
import { WaveAnimation } from '../wave-animation/WaveAnimation';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { useUIStore } from '../../stores/ui-store';
import { useTranscription } from '../../hooks/use-transcription';

interface TypingIndicatorProps {
  showTranscription?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  showTranscription = true 
}) => {
  const { currentVolume, showWaveAnimation } = useUIStore();
  const { outputTranscription } = useTranscription();

  const hasOutputTranscription = outputTranscription.currentTranscript.trim().length > 0;
  const isAISpeaking = outputTranscription.isTranscribing || showWaveAnimation;

  return (
    <div className="message-bubble assistant typing">
      <div className="message-avatar">
        <FiCpu />
      </div>
      
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">AI 助手</span>
          <div className="ai-status">
            {isAISpeaking ? (
              <>
                <FiVolume2 className="speaking-icon" />
                <span className="typing-status">正在說話...</span>
              </>
            ) : (
              <>
                <FiVolumeX className="idle-icon" />
                <span className="typing-status">準備中...</span>
              </>
            )}
          </div>
        </div>
        
        {/* 顯示 AI 語音轉錄 */}
        {showTranscription && hasOutputTranscription && (
          <div className="ai-transcription-section">
            <TranscriptionDisplay
              type="output"
              allowEdit={false}
            />
          </div>
        )}
        
        {/* 顯示語音動畫或轉錄文字 */}
        <div className="ai-output-content">
          {isAISpeaking && (
            <div className="typing-animation">
              <WaveAnimation isActive={true} volume={currentVolume} />
            </div>
          )}
          
          {/* 如果有轉錄但沒有顯示轉錄組件，則顯示簡化的轉錄文字 */}
          {!showTranscription && hasOutputTranscription && (
            <div className="simple-transcription">
              <p className="ai-speech-text">{outputTranscription.currentTranscript}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};