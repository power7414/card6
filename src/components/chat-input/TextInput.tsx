import React from 'react';

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
  placeholder = "在這裡輸入訊息...",
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="text-input-container">
      <textarea
        className="text-input"
        value={value}
        onChange={handleChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          minHeight: '40px',
          maxHeight: '120px',
          resize: 'none'
        }}
      />
    </div>
  );
};