import React, { useEffect, useRef } from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onKeyPress,
  placeholder = "問我任何問題...",
  disabled = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    
    // Auto-resize functionality
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  // Auto-resize when value changes externally
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className="text-input"
      value={value}
      onChange={handleChange}
      onKeyDown={onKeyPress}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      spellCheck="true"
      style={{
        minHeight: '24px',
        maxHeight: '200px',
        resize: 'none',
        overflow: 'hidden'
      }}
    />
  );
};