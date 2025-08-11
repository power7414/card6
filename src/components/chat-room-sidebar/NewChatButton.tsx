import React from 'react';
import { FiPlus } from 'react-icons/fi';

interface NewChatButtonProps {
  onClick: () => void;
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({ onClick }) => {
  return (
    <button className="new-chat-button" onClick={onClick} aria-label="創建新聊天室">
      <FiPlus />
      <span>新對話</span>
    </button>
  );
};