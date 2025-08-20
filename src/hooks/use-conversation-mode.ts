/**
 * Hook for managing conversation mode state (Live API vs STT+TTS)
 */

import { useState, useCallback, useEffect } from 'react';
import { ConversationMode } from '../components/chat-input/ConversationModeSelector';

export interface UseConversationModeResult {
  /** Current conversation mode */
  currentMode: ConversationMode;
  /** Switch to a different mode */
  switchMode: (mode: ConversationMode) => void;
  /** Check if currently in Live API mode */
  isLiveMode: boolean;
  /** Check if currently in STT+TTS mode */
  isSTTTTSMode: boolean;
  /** Whether mode switching is disabled (e.g., during active conversation) */
  canSwitchMode: boolean;
  /** Set whether mode switching is allowed */
  setCanSwitchMode: (canSwitch: boolean) => void;
}

export function useConversationMode(
  initialMode: ConversationMode = 'live-api'
): UseConversationModeResult {
  const [currentMode, setCurrentMode] = useState<ConversationMode>(initialMode);
  const [canSwitchMode, setCanSwitchMode] = useState<boolean>(true);

  // Load mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('conversation-mode') as ConversationMode;
    if (savedMode && (savedMode === 'live-api' || savedMode === 'stt-tts')) {
      setCurrentMode(savedMode);
    }
  }, []);

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('conversation-mode', currentMode);
  }, [currentMode]);

  const switchMode = useCallback((mode: ConversationMode) => {
    if (!canSwitchMode) {
      console.warn('[useConversationMode] Mode switching is disabled');
      return;
    }

    if (mode === currentMode) {
      return;
    }

    console.log(`[useConversationMode] Switching from ${currentMode} to ${mode}`);
    setCurrentMode(mode);
  }, [currentMode, canSwitchMode]);

  const isLiveMode = currentMode === 'live-api';
  const isSTTTTSMode = currentMode === 'stt-tts';

  return {
    currentMode,
    switchMode,
    isLiveMode,
    isSTTTTSMode,
    canSwitchMode,
    setCanSwitchMode,
  };
}