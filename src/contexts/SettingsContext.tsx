import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SettingsData, ToneValue, VoiceValue } from '../components/shared/SettingsModal';
import { generateSystemPrompt, generateTTSStylePrompt } from '../utils/system-prompt-generator';

interface SettingsContextValue {
  // Current settings
  settings: SettingsData;
  
  // Generated prompts based on current settings
  systemPrompt: string;
  ttsStylePrompt: string;
  
  // Actions
  updateSettings: (newSettings: Partial<SettingsData>) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Default settings
const DEFAULT_SETTINGS: SettingsData = {
  tone: 'lively' as ToneValue,
  voice: 'Kore' as VoiceValue,
  models: {
    liveApi: 'gemini-live-2.5-flash-preview', // 標準 Live API 模型
    llm: 'gemini-2.5-flash', // 快速回應的 LLM
    tts: 'gemini-2.5-flash-preview-tts' // 快速 TTS
  }
};

// Storage key for persisting settings
const SETTINGS_STORAGE_KEY = 'ai-chat-settings';

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  // Initialize settings from localStorage or defaults
  const [settings, setSettings] = useState<SettingsData>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the stored data has the expected structure
        if (parsed.tone && parsed.voice) {
          return {
            tone: parsed.tone as ToneValue,
            voice: parsed.voice as VoiceValue,
            // 向後相容：如果沒有模型設定，使用預設值
            models: parsed.models ? {
              liveApi: parsed.models.liveApi || DEFAULT_SETTINGS.models.liveApi,
              llm: parsed.models.llm || DEFAULT_SETTINGS.models.llm,
              tts: parsed.models.tts || DEFAULT_SETTINGS.models.tts
            } : DEFAULT_SETTINGS.models
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Generate prompts based on current settings
  const systemPrompt = generateSystemPrompt(settings.tone);
  const ttsStylePrompt = generateTTSStylePrompt(settings.tone);

  // Live API 整合將在其他地方處理，避免循環依賴

  // Update settings and persist to localStorage
  const updateSettings = useCallback((newSettings: Partial<SettingsData>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      
      // Persist to localStorage
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      } catch (error) {
        console.warn('Failed to persist settings to localStorage:', error);
      }
      
      // Live API 配置更新將透過 useEffect 在其他地方處理
      
      return updatedSettings;
    });
  }, []);

  // Reset to default settings
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear settings from localStorage:', error);
    }
  }, []);

  // Log settings changes for debugging
  useEffect(() => {
    // Settings updated silently for performance
  }, [settings, systemPrompt, ttsStylePrompt]);

  const contextValue: SettingsContextValue = {
    settings,
    systemPrompt,
    ttsStylePrompt,
    updateSettings,
    resetToDefaults
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

// Hook to use the settings context
export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  
  return context;
};