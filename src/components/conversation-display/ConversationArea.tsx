import React from 'react';
import { MessageList } from './MessageList';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { useChatManager } from '../../hooks/use-chat-manager';
import { usePersistentChatStore } from '../../stores/chat-store-persistent';
import './conversation-display.scss';

export const ConversationArea: React.FC = () => {
  const { getActiveChatRoom } = useChatManager();
  const { currentTranscript, isRecording } = usePersistentChatStore();
  const activeChatRoom = getActiveChatRoom();

  return (
    <div className="conversation-area">
      <div className="conversation-content">
        {activeChatRoom ? (
          <MessageList messages={activeChatRoom.messages} />
        ) : (
          <div className="conversation-empty">
            <h2>歡迎使用對話測試平台</h2>
            <p>選擇一個聊天室開始對話，或創建新的聊天室</p>
          </div>
        )}
      </div>
      
      {(isRecording || currentTranscript) && (
        <TranscriptionDisplay
          type="input"
          allowEdit={true}
        />
      )}
    </div>
  );
};