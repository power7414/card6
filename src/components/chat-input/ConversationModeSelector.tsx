/**
 * ConversationModeSelector component
 * Dropdown selector for switching between Live API mode and STT+TTS mode
 */

import React, { memo, useState, useRef, useEffect } from 'react';
import cn from 'classnames';
import './conversation-mode-selector.scss';

export type ConversationMode = 'live-api' | 'stt-tts';

export interface ConversationModeSelectorProps {
  currentMode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  disabled?: boolean;
}

interface ModeOption {
  value: ConversationMode;
  label: string;
  description: string;
  iconPath: string;
  fallbackIcon: string; // Material icon as fallback
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'live-api',
    label: 'Live API',
    description: '即時語音對話',
    iconPath: '/images/mode-icons/live-api.png',
    fallbackIcon: 'record_voice_over'
  },
  {
    value: 'stt-tts',
    label: 'STT + TTS',
    description: '語音轉文字 + 文字轉語音',
    iconPath: '/images/mode-icons/stt-tts.svg',
    fallbackIcon: 'hearing'
  }
];

export const ConversationModeSelector: React.FC<ConversationModeSelectorProps> = memo(({
  currentMode,
  onModeChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = MODE_OPTIONS.find(option => option.value === currentMode);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleModeChange = (mode: ConversationMode) => {
    if (!disabled && mode !== currentMode) {
      onModeChange(mode);
      setIsOpen(false);
    }
  };

  const handleImageError = (iconPath: string) => {
    setImageErrors(prev => ({ ...prev, [iconPath]: true }));
  };

  const renderIcon = (option: ModeOption, size: 'small' | 'large' = 'small') => {
    const hasError = imageErrors[option.iconPath];
    const iconClass = size === 'large' ? 'mode-icon-large' : 'mode-icon';
    
    if (hasError) {
      // Use fallback material icon
      return (
        <span className={cn('material-symbols-outlined', iconClass)}>
          {option.fallbackIcon}
        </span>
      );
    }
    
    return (
      <img 
        src={option.iconPath}
        alt={option.label}
        className={iconClass}
        onError={() => handleImageError(option.iconPath)}
      />
    );
  };

  return (
    <div 
      ref={dropdownRef}
      className={cn('conversation-mode-selector', { disabled, open: isOpen })}
    >
      <div 
        className={cn('mode-selector-trigger', { disabled })}
        onClick={handleToggle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="選擇對話模式"
      >
        <div className="selected-mode">
          <div className="mode-info">
            {currentOption && (
              <>
                <div className="mode-avatar">
                  {renderIcon(currentOption)}
                </div>
                <span className="mode-label">{currentOption.label}</span>
              </>
            )}
          </div>
        </div>
        <span className={cn('dropdown-arrow material-symbols-outlined', { rotated: isOpen })}>
          expand_more
        </span>
      </div>
      
      {isOpen && (
        <div className="mode-dropdown">
          {MODE_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={cn('mode-option', { 
                active: option.value === currentMode,
                disabled 
              })}
              onClick={() => handleModeChange(option.value)}
              role="option"
              aria-selected={option.value === currentMode}
            >
              <div className="option-info">
                <div className="mode-avatar">
                  {renderIcon(option)}
                </div>
                <span className="option-label">{option.label}</span>
              </div>
              {option.value === currentMode && (
                <span className="material-symbols-outlined check-icon">
                  check
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

ConversationModeSelector.displayName = 'ConversationModeSelector';