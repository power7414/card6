import React, { useState } from 'react';
import { FiMessageCircle, FiMoreVertical, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { ChatRoom } from '../../types/chat';

interface ChatItemProps {
  chatRoom: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  chatRoom,
  isActive,
  onClick,
  onDelete,
  onRename
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onRename();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete();
  };

  const lastMessage = chatRoom.messages[chatRoom.messages.length - 1];
  const preview = lastMessage?.content.slice(0, 50) || '新對話';

  return (
    <div className={`chat-item ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="chat-item-icon">
        <FiMessageCircle />
      </div>
      
      <div className="chat-item-content">
        <div className="chat-item-header">
          <h3 className="chat-item-title">{chatRoom.name}</h3>
          <button 
            className="chat-item-menu-button"
            onClick={handleMenuToggle}
            aria-label="聊天室選項"
          >
            <FiMoreVertical />
          </button>
          
          {showMenu && (
            <div className="chat-item-menu">
              <button onClick={handleRename}>
                <FiEdit2 />
                <span>重命名</span>
              </button>
              <button onClick={handleDelete} className="delete">
                <FiTrash2 />
                <span>刪除</span>
              </button>
            </div>
          )}
        </div>
        
        <p className="chat-item-preview">{preview}</p>
        
        <div className="chat-item-meta">
          <span className="message-count">{chatRoom.messages.length} 則訊息</span>
          <span className="last-active">
            {new Date(chatRoom.lastMessageAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};