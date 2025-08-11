import React from 'react';
import { FiSend } from 'react-icons/fi';

interface SendButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const SendButton: React.FC<SendButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      className={`send-button ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="發送訊息"
    >
      <FiSend />
    </button>
  );
};