/**
 * Hook for managing Gemini STT+TTS conversation mode
 * Integrates GeminiChatService, GeminiSTTService, and GeminiTTSService
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { GeminiChatService } from '../services/gemini/gemini-chat';
import { OpenAISTTService, STTResult, STTEvents } from '../services/openai/openai-stt';
import { GeminiTTSService } from '../services/gemini/gemini-tts';
import { useChatManager } from './use-chat-manager';
import { createUserMessage, createAssistantMessage } from '../utils/message-factory';
import { useSettings } from '../contexts/SettingsContext';

export interface UseGeminiConversationConfig {
  /** Gemini API key for Chat and TTS */
  geminiApiKey?: string;
  /** OpenAI API key for STT */
  openaiApiKey?: string;
  /** Language for STT */
  sttLanguage?: string;
  /** Language for TTS */
  ttsLanguage?: string;
  /** Enable logging */
  enableLogging?: boolean;
  /** Disable TTS temporarily (for testing or quota issues) */
  disableTTS?: boolean;
  /** Enable STT+TTS services - only initialize when needed */
  enabled?: boolean;
}

export interface UseGeminiConversationResult {
  // STT State
  isListening: boolean;
  currentTranscript: string;
  isTranscriptFinal: boolean;
  
  // TTS State
  isSpeaking: boolean;
  
  // Chat State
  isProcessingChat: boolean;
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  sendTextMessage: (message: string) => Promise<void>;
  speakMessage: (message: string) => Promise<void>;
  
  // Configuration
  updateConfig: (config: Partial<UseGeminiConversationConfig>) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
  
  // Service availability
  isSTTSupported: boolean;
  isTTSSupported: boolean;
}

export function useGeminiConversation(
  config: UseGeminiConversationConfig = {}
): UseGeminiConversationResult {
  const { activeChatRoom, addMessage, chatRooms } = useChatManager();
  const { settings, ttsStylePrompt } = useSettings();
  
  // Services
  const chatServiceRef = useRef<GeminiChatService | null>(null);
  const sttServiceRef = useRef<OpenAISTTService | null>(null);
  const ttsServiceRef = useRef<GeminiTTSService | null>(null);
  
  // State
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<UseGeminiConversationConfig>(config);
  
  // Initialize services when config changes - 只在 enabled: true 時初始化
  useEffect(() => {
    // Only initialize services if explicitly enabled
    if (!currentConfig.enabled) {
      return;
    }
    
    try {
      // Initialize Chat Service
      if (currentConfig.geminiApiKey) {
        chatServiceRef.current = new GeminiChatService({
          apiKey: currentConfig.geminiApiKey,
          model: settings.models.llm, // 使用選擇的 LLM 模型
          enableLogging: currentConfig.enableLogging
        });
      }
      
      // Initialize OpenAI STT Service
      if (currentConfig.openaiApiKey) {
        sttServiceRef.current = new OpenAISTTService({
          apiKey: currentConfig.openaiApiKey,
          audioFormat: 'audio/webm',
          segmentDuration: 5, // 5-second segments for OpenAI Whisper
          sampleRate: 16000,
          enableLogging: currentConfig.enableLogging,
          language: currentConfig.sttLanguage === 'en-US' ? 'en' : 'zh',
          model: 'whisper-1'
        });
      }
      
      // Initialize TTS Service
      if (currentConfig.geminiApiKey) {
        ttsServiceRef.current = new GeminiTTSService({
          apiKey: currentConfig.geminiApiKey,
          model: settings.models.tts, // 使用選擇的 TTS 模型
          enableLogging: currentConfig.enableLogging,
          voice: {
            voiceName: settings.voice, // Use voice from settings
            stylePrompt: ttsStylePrompt // Use tone-based style prompt
          }
        });
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize services');
    }
  }, [currentConfig, settings, settings.models.llm, settings.models.tts, ttsStylePrompt]);

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

  // STT Event handlers
  const sttEvents: STTEvents = {
    onResult: (result: STTResult) => {
      // For segmented results, accumulate transcripts
      if (result.segmentIndex === 0) {
        setCurrentTranscript(result.transcript);
      } else {
        setCurrentTranscript(prev => `${prev} ${result.transcript}`);
      }
      setIsTranscriptFinal(result.isFinal);
      
      // Auto-send when final transcript is received from any segment
      if (result.isFinal && result.transcript.trim()) {
        const fullTranscript = result.segmentIndex === 0 ? 
          result.transcript : 
          `${currentTranscript} ${result.transcript}`;
        sendTextMessage(fullTranscript.trim());
      }
    },
    onStart: () => {
      setIsListening(true);
      setCurrentTranscript('');
      setIsTranscriptFinal(false);
      clearError();
    },
    onEnd: () => {
      setIsListening(false);
    },
    onError: (errorMessage: string) => {
      setError(errorMessage);
      setIsListening(false);
    },
    onSegmentStart: (segmentIndex: number) => {
      // Visual feedback for segment processing
      if (currentConfig.enableLogging) {
        console.log(`[STT] Processing segment ${segmentIndex}`);
      }
    },
    onSegmentEnd: (segmentIndex: number) => {
      // Visual feedback for segment completion
      if (currentConfig.enableLogging) {
        console.log(`[STT] Completed segment ${segmentIndex}`);
      }
    },
    // VAD Events
    onVADSpeechStart: () => {
      if (currentConfig.enableLogging) {
        console.log('[VAD] Speech detected - starting recording');
      }
      setIsListening(true);
    },
    onVADSpeechEnd: () => {
      if (currentConfig.enableLogging) {
        console.log('[VAD] Speech ended - processing audio');
      }
    },
    onVADVolumeChange: (volume: number) => {
      // Optional: Can be used for visual volume indicators
      if (currentConfig.enableLogging && volume > 0.1) {
        console.log(`[VAD] Volume level: ${(volume * 100).toFixed(1)}%`);
      }
    },
    // Streaming Events
    onStreamingResult: (partialResult: string) => {
      if (currentConfig.enableLogging) {
        console.log(`[Streaming] Partial result: "${partialResult}"`);
      }
      // Update current transcript with streaming result
      setCurrentTranscript(partialResult);
      setIsTranscriptFinal(false);
    }
  };

  const startListening = useCallback(async () => {
    if (!sttServiceRef.current) {
      setError('Speech recognition service not available');
      return;
    }

    try {
      await sttServiceRef.current.startRecognition(sttEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
    }
  }, [sttEvents]);

  const stopListening = useCallback(() => {
    if (sttServiceRef.current) {
      sttServiceRef.current.stopRecognition();
    }
  }, []);

  const sendTextMessage = useCallback(async (message: string) => {
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
      setCurrentTranscript('');
      setIsTranscriptFinal(false);
    }
  }, [activeChatRoom, addMessage, chatRooms, clearError, currentConfig.disableTTS, currentConfig.enableLogging, currentConfig.geminiApiKey, settings.voice, ttsStylePrompt]);

  const speakMessage = useCallback(async (message: string) => {
    if (!ttsServiceRef.current) {
      console.warn('TTS service not available');
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
  }, [settings.voice, ttsStylePrompt]);

  // Check service availability
  const isSTTSupported = OpenAISTTService.isSupported();
  const isTTSSupported = GeminiTTSService.isAudioSupported();

  return {
    // STT State
    isListening,
    currentTranscript,
    isTranscriptFinal,
    
    // TTS State
    isSpeaking,
    
    // Chat State
    isProcessingChat,
    
    // Actions
    startListening,
    stopListening,
    sendTextMessage,
    speakMessage,
    
    // Configuration
    updateConfig,
    
    // Error handling
    error,
    clearError,
    
    // Service availability
    isSTTSupported,
    isTTSSupported,
  };
}