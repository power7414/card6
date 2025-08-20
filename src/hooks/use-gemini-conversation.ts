/**
 * Hook for managing Gemini STT+TTS conversation mode
 * Integrates GeminiChatService, GeminiSTTService, and GeminiTTSService
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { GeminiChatService } from '../services/gemini/gemini-chat';
import { GeminiSTTService, STTResult, STTEvents } from '../services/gemini/gemini-stt';
import { GeminiTTSService } from '../services/gemini/gemini-tts';
import { useChatManager } from './use-chat-manager';
import { createUserMessage, createAssistantMessage } from '../utils/message-factory';

export interface UseGeminiConversationConfig {
  /** Gemini API key */
  apiKey?: string;
  /** Language for STT */
  sttLanguage?: string;
  /** Language for TTS */
  ttsLanguage?: string;
  /** Enable logging */
  enableLogging?: boolean;
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
  const { activeChatRoom, addMessage } = useChatManager();
  
  // Services
  const chatServiceRef = useRef<GeminiChatService | null>(null);
  const sttServiceRef = useRef<GeminiSTTService | null>(null);
  const ttsServiceRef = useRef<GeminiTTSService | null>(null);
  
  // State
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<UseGeminiConversationConfig>(config);
  
  // Initialize services when config changes
  useEffect(() => {
    try {
      // Initialize Chat Service
      if (currentConfig.apiKey) {
        chatServiceRef.current = new GeminiChatService({
          apiKey: currentConfig.apiKey,
          enableLogging: currentConfig.enableLogging
        });
      }
      
      // Initialize STT Service
      if (currentConfig.apiKey) {
        sttServiceRef.current = new GeminiSTTService({
          apiKey: currentConfig.apiKey,
          audioFormat: 'audio/wav',
          segmentDuration: 3, // 3-second segments for near real-time
          sampleRate: 16000,
          enableLogging: currentConfig.enableLogging,
          transcriptionPrompt: currentConfig.sttLanguage === 'en-US' ?
            'Please transcribe this English audio to text.' :
            'Please transcribe this Chinese audio to text.'
        });
      }
      
      // Initialize TTS Service
      if (currentConfig.apiKey) {
        ttsServiceRef.current = new GeminiTTSService({
          apiKey: currentConfig.apiKey,
          enableLogging: currentConfig.enableLogging,
          voice: {
            voiceName: 'Kore', // Default voice
            stylePrompt: currentConfig.ttsLanguage === 'en-US' ? 
              'Speak naturally in American English' : 
              'Speak naturally in Traditional Chinese'
          }
        });
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize services');
    }
  }, [currentConfig]);

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
      console.log(`[STT] Processing segment ${segmentIndex}`);
    },
    onSegmentEnd: (segmentIndex: number) => {
      // Visual feedback for segment completion
      console.log(`[STT] Completed segment ${segmentIndex}`);
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

      // Get AI response
      const response = await chatServiceRef.current.chat(message);
      
      // Add AI response to chat
      const assistantMessage = createAssistantMessage(response);
      await addMessage(activeChatRoom, assistantMessage);

      // Auto-speak the response if TTS is available
      if (ttsServiceRef.current) {
        try {
          await ttsServiceRef.current.speakText({
            text: response,
            voice: {
              voiceName: 'Kore',
              stylePrompt: currentConfig.ttsLanguage === 'en-US' ? 
                'Speak naturally in American English' : 
                'Speak naturally in Traditional Chinese'
            }
          });
          setIsSpeaking(true);
          // Note: TTS will set isSpeaking to false when complete
        } catch (ttsErr) {
          console.error('TTS error:', ttsErr);
        }
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
  }, [activeChatRoom, addMessage, clearError]);

  const speakMessage = useCallback(async (message: string) => {
    if (!ttsServiceRef.current) {
      console.warn('TTS service not available');
      return;
    }

    setIsSpeaking(true);
    
    try {
      await ttsServiceRef.current.speakText({
        text: message,
        voice: {
          voiceName: 'Kore',
          stylePrompt: currentConfig.ttsLanguage === 'en-US' ? 
            'Speak naturally in American English' : 
            'Speak naturally in Traditional Chinese'
        }
      });
    } catch (err) {
      console.error('TTS error:', err);
      // Don't set error for TTS failures as they're not critical
    } finally {
      setIsSpeaking(false);
    }
  }, [currentConfig]);

  // Check service availability
  const isSTTSupported = GeminiSTTService.isSupported();
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