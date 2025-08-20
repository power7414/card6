import React from 'react';
import { Message } from '../../types/chat';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast }) => {
  const isUser = message.type === 'user';

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isLast ? 'last' : ''}`}>
      <div className="message-avatar">
        {isUser ? (
          <img src="/images/avatars/user-avatar.png" alt="User Avatar" />
        ) : (
          <img src="/images/avatars/ai-avatar.png" alt="AI Avatar" />
        )}
      </div>
      
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {isUser ? '你' : '國泰小樹'}
          </span>
          <span className="message-time">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        <div className="message-text">
          {message.content}
        </div>
        
        {message.transcription && (
          <div className="message-transcription">
            <span className="transcription-label">轉錄：</span>
            {message.transcription}
          </div>
        )}
      </div>
    </div>
  );
};