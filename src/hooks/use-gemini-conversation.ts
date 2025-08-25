/**
 * Hook for managing Gemini STT+TTS conversation mode
 * Integrates GeminiChatService, GeminiSTTService, and GeminiTTSService
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { GeminiChatService } from '../services/gemini/gemini-chat';
import { GeminiTTSService } from '../services/gemini/gemini-tts';
import { useChatManager } from './use-chat-manager';
import { createUserMessage, createAssistantMessage } from '../utils/message-factory';
import { useSettings } from '../contexts/SettingsContext';

export interface UseGeminiConversationConfig {
  /** Gemini API key for Chat and TTS */
  geminiApiKey?: string;
  /** Language for TTS */
  ttsLanguage?: string;
  /** Enable logging */
  enableLogging?: boolean;
  /** Disable TTS temporarily (for testing or quota issues) */
  disableTTS?: boolean;
  /** Enable LLM+TTS services - only initialize when needed */
  enabled?: boolean;
}

export interface UseGeminiConversationResult {
  // Connection State (類似 Live API)
  connected: boolean;
  ready: boolean;
  
  // TTS State
  isSpeaking: boolean;
  
  // Chat State
  isProcessingChat: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  sendTextMessage: (message: string) => Promise<void>;
  speakMessage: (message: string) => Promise<void>;
  
  // Configuration
  updateConfig: (config: Partial<UseGeminiConversationConfig>) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
  
  // Service availability
  isTTSSupported: boolean;
}

export function useGeminiConversation(
  config: UseGeminiConversationConfig = {}
): UseGeminiConversationResult {
  const { activeChatRoom, addMessage, chatRooms } = useChatManager();
  const { settings, ttsStylePrompt } = useSettings();
  
  // Services (移除 STT)
  const chatServiceRef = useRef<GeminiChatService | null>(null);
  const ttsServiceRef = useRef<GeminiTTSService | null>(null);
  
  // Connection State (類似 Live API)
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  
  // State (移除 STT 相關狀態)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<UseGeminiConversationConfig>(config);
  
  // Connect function - 手動初始化服務 (LLM+TTS 模式)
  const connect = useCallback(async () => {
    if (connected) {
      console.log('Already connected to LLM+TTS services');
      return;
    }

    setError(null);
    setConnected(true);
    setReady(false);
    
    try {
      // Initialize Chat Service
      if (currentConfig.geminiApiKey) {
        chatServiceRef.current = new GeminiChatService({
          apiKey: currentConfig.geminiApiKey,
          model: settings.models.llm,
          enableLogging: currentConfig.enableLogging
        });
      } else {
        throw new Error('Gemini API key is required');
      }
      
      // Initialize TTS Service
      if (currentConfig.geminiApiKey) {
        ttsServiceRef.current = new GeminiTTSService({
          apiKey: currentConfig.geminiApiKey,
          model: settings.models.tts,
          enableLogging: currentConfig.enableLogging,
          voice: {
            voiceName: settings.voice,
            stylePrompt: ttsStylePrompt
          }
        });
      }
      
      console.log('✅ LLM+TTS services initialized successfully');
      setReady(true);
      setError(null);
      
    } catch (err) {
      console.error('❌ Failed to initialize LLM+TTS services:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize services');
      setConnected(false);
      setReady(false);
      
      // Clean up partially initialized services
      chatServiceRef.current = null;
      ttsServiceRef.current = null;
    }
  }, [currentConfig, settings, ttsStylePrompt, connected]);

  // Disconnect function - 清理服務
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting LLM+TTS services');
    
    // Clean up services
    chatServiceRef.current = null;
    ttsServiceRef.current = null;
    
    // Reset states
    setConnected(false);
    setReady(false);
    setIsSpeaking(false);
    setIsProcessingChat(false);
    setError(null);
  }, []);

  // Update TTS service configuration when settings change
  useEffect(() => {
    if (ttsServiceRef.current) {
      ttsServiceRef.current.updateVoiceConfig({
        voiceName: settings.voice,
        stylePrompt: ttsStylePrompt
      });
      // TTS config updated silently
    }
  }, [settings.voice, ttsStylePrompt]);

  const updateConfig = useCallback((newConfig: Partial<UseGeminiConversationConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // STT 功能已移除，只保留 LLM + TTS

  const sendTextMessage = useCallback(async (message: string) => {
    if (!connected || !ready) {
      setError('Please connect to LLM+TTS services first');
      return;
    }
    
    if (!activeChatRoom || !chatServiceRef.current) {
      setError('No active chat room or chat service not available');
      return;
    }

    setIsProcessingChat(true);
    clearError();

    try {
      // Add user message to chat
      const userMessage = createUserMessage(message.trim());
      await addMessage(activeChatRoom, userMessage);

      // Get chat history for context (including the message we just added)
      const currentChatRoom = chatRooms.find(room => room.id === activeChatRoom);
      const chatHistory = currentChatRoom?.messages || [];
      
      // Log for debugging
      if (currentConfig.enableLogging) {
        console.log(`[GeminiConversation] Chat history contains ${chatHistory.length} messages`);
        console.log(`[GeminiConversation] Last 3 messages:`, chatHistory.slice(-3).map(m => ({
          type: m.type,
          content: m.content.substring(0, 50) + '...'
        })));
      }
      
      // Get AI response with chat history context
      const response = await chatServiceRef.current.chat(message, chatHistory);
      
      // Store response but don't add to chat yet - wait for TTS to complete
      let assistantMessage: any = null;

      // Auto-speak the response if TTS is available and not disabled
      if (ttsServiceRef.current && !currentConfig.disableTTS) {
        try {
          if (currentConfig.enableLogging) {
            console.log('[GeminiConversation] Starting TTS for response:', response.substring(0, 50) + '...');
            console.log('[GeminiConversation] TTS service available:', !!ttsServiceRef.current);
          }

          // Use callbacks for more reliable state management
          await ttsServiceRef.current.speakText({
            text: response,
            voice: {
              voiceName: settings.voice,
              stylePrompt: ttsStylePrompt
            },
            onStart: () => {
              if (currentConfig.enableLogging) {
                console.log('[GeminiConversation] TTS playback started');
              }
              setIsSpeaking(true);
            },
            onEnd: () => {
              if (currentConfig.enableLogging) {
                console.log('[GeminiConversation] TTS playback ended');
              }
              setIsSpeaking(false);
            },
            onError: (error: string) => {
              console.error('[GeminiConversation] TTS playback error:', error);
              setIsSpeaking(false);
            }
          });
          
          // TTS completed successfully - now add the message to chat
          assistantMessage = createAssistantMessage(response);
          await addMessage(activeChatRoom, assistantMessage);
          
        } catch (ttsErr) {
          console.error('[GeminiConversation] TTS error:', ttsErr);
          console.error('[GeminiConversation] TTS error details:', {
            error: ttsErr,
            ttsServiceAvailable: !!ttsServiceRef.current,
            geminiApiKey: !!currentConfig.geminiApiKey,
            responseLength: response.length
          });
          setIsSpeaking(false);
          
          // Even if TTS fails, still show the text message
          assistantMessage = createAssistantMessage(response);
          await addMessage(activeChatRoom, assistantMessage);
        }
      } else {
        // No TTS available or TTS disabled - add message immediately
        if (currentConfig.enableLogging) {
          console.log('[GeminiConversation] TTS skipped (disabled or not available)');
        }
        assistantMessage = createAssistantMessage(response);
        await addMessage(activeChatRoom, assistantMessage);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Add error message to chat
      const errorMsg = createAssistantMessage(`抱歉，發生錯誤：${errorMessage}`);
      await addMessage(activeChatRoom, errorMsg);
    } finally {
      setIsProcessingChat(false);
    }
  }, [activeChatRoom, addMessage, chatRooms, clearError, currentConfig.disableTTS, currentConfig.enableLogging, currentConfig.geminiApiKey, settings.voice, ttsStylePrompt, connected, ready]);

  const speakMessage = useCallback(async (message: string) => {
    if (!connected || !ready) {
      setError('Please connect to LLM+TTS services first');
      return;
    }
    
    if (!ttsServiceRef.current) {
      setError('TTS service not available');
      return;
    }
    
    try {
      await ttsServiceRef.current.speakText({
        text: message,
        voice: {
          voiceName: settings.voice,
          stylePrompt: ttsStylePrompt
        },
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
        },
        onError: (error: string) => {
          console.error('TTS playback error:', error);
          setIsSpeaking(false);
        }
      });
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
    }
  }, [settings.voice, ttsStylePrompt, connected, ready]);

  // Check service availability (移除 STT)
  const isTTSSupported = GeminiTTSService.isAudioSupported();

  return {
    // Connection State (類似 Live API)
    connected,
    ready,
    
    // TTS State
    isSpeaking,
    
    // Chat State
    isProcessingChat,
    
    // Actions
    connect,
    disconnect,
    sendTextMessage,
    speakMessage,
    
    // Configuration
    updateConfig,
    
    // Error handling
    error,
    clearError,
    
    // Service availability
    isTTSSupported,
  };
}