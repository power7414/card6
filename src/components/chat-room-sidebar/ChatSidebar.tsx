import React from 'react';
import { ChatList } from './ChatList';
import { NewChatButton } from './NewChatButton';
import { useChatManager } from '../../hooks/use-chat-manager';
import './chat-room-sidebar.scss';

export const ChatSidebar: React.FC = () => {
  const { createNewChatRoom } = useChatManager();

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>聊天室</h2>
        <NewChatButton onClick={createNewChatRoom} />
      </div>
      
      <div className="chat-sidebar-content">
        <ChatList />
      </div>
    </div>
  );
};