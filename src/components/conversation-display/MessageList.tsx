import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Message } from '../../types/chat';

interface MessageListProps {
  messages: Message[];
  isSpeaking?: boolean;
  isProcessingChat?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isSpeaking = false, 
  isProcessingChat = false 
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動滾動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSpeaking, isProcessingChat]);

  return (
    <div className="message-list">
      <div className="messages-container">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}
        
        {/* Show AI thinking/speaking indicator */}
        {(isProcessingChat || isSpeaking) && (
          <div className="message-bubble assistant-bubble status-bubble">
            <div className="message-content">
              <div className="typing-indicator">
                {isProcessingChat && !isSpeaking && (
                  <>
                    <span className="material-symbols-outlined">psychology</span>
                    AI 正在思考...
                  </>
                )}
                {isSpeaking && (
                  <>
                    <span className="material-symbols-outlined">volume_up</span>
                    AI 正在說話...
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};