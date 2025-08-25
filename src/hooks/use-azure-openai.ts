/**
 * Azure OpenAI React Hook
 * 提供簡單易用的 React 介面來使用 Azure OpenAI 服務
 */

import { useState, useCallback, useRef } from 'react';
import { azureOpenAIService, ChatMessage, ChatCompletionRequest } from '../services/azure-openai/azure-openai-service';

export interface UseAzureOpenAIResult {
  // 對話功能
  sendMessage: (message: string, options?: Partial<ChatCompletionRequest>) => Promise<string>;
  sendMessages: (messages: ChatMessage[], options?: Partial<ChatCompletionRequest>) => Promise<string>;
  
  // 串流對話功能
  sendStreamMessage: (
    message: string, 
    onChunk: (chunk: string) => void,
    options?: Partial<ChatCompletionRequest>
  ) => Promise<void>;
  
  // 語音轉文字功能
  transcribeAudio: (audioFile: File, language?: string) => Promise<string>;
  
  // 狀態
  isLoading: boolean;
  error: string | null;
  lastResponse: string | null;
  
  // 控制函數
  clearError: () => void;
  checkHealth: () => Promise<boolean>;
}

export function useAzureOpenAI(
  systemPrompt: string = '你是一個專業的 AI 助手。',
  defaultOptions?: Partial<ChatCompletionRequest>
): UseAzureOpenAIResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  
  // 使用 ref 來避免依賴性問題
  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (
    message: string, 
    options?: Partial<ChatCompletionRequest>
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPromptRef.current },
        { role: 'user', content: message }
      ];

      const response = await azureOpenAIService.chatCompletion({
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        ...defaultOptions,
        ...options,
      });

      const responseText = response.choices[0].message.content;
      setLastResponse(responseText);
      return responseText;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Azure OpenAI 請求失敗';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [defaultOptions]);

  const sendMessages = useCallback(async (
    messages: ChatMessage[], 
    options?: Partial<ChatCompletionRequest>
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      // 如果沒有系統提示，添加一個
      const messagesWithSystem = messages[0]?.role === 'system' 
        ? messages 
        : [{ role: 'system' as const, content: systemPromptRef.current }, ...messages];

      const response = await azureOpenAIService.chatCompletion({
        messages: messagesWithSystem,
        max_tokens: 1000,
        temperature: 0.7,
        ...defaultOptions,
        ...options,
      });

      const responseText = response.choices[0].message.content;
      setLastResponse(responseText);
      return responseText;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Azure OpenAI 請求失敗';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [defaultOptions]);

  const sendStreamMessage = useCallback(async (
    message: string,
    onChunk: (chunk: string) => void,
    options?: Partial<ChatCompletionRequest>
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    let fullResponse = '';

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPromptRef.current },
        { role: 'user', content: message }
      ];

      await azureOpenAIService.chatCompletionStream(
        {
          messages,
          max_tokens: 1000,
          temperature: 0.7,
          ...defaultOptions,
          ...options,
        },
        (chunk: string) => {
          fullResponse += chunk;
          onChunk(chunk);
        },
        () => {
          setLastResponse(fullResponse);
          setIsLoading(false);
        },
        (err: Error) => {
          const errorMessage = err.message || 'Azure OpenAI 串流請求失敗';
          setError(errorMessage);
          setIsLoading(false);
          throw err;
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Azure OpenAI 串流請求失敗';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [defaultOptions]);

  const transcribeAudio = useCallback(async (
    audioFile: File, 
    language: string = 'zh'
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await azureOpenAIService.transcribeAudio({
        file: audioFile,
        language,
        response_format: 'json',
        temperature: 0,
      });

      setLastResponse(response.text);
      return response.text;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Azure OpenAI Whisper 請求失敗';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const isHealthy = await azureOpenAIService.checkHealth();
      if (!isHealthy) {
        setError('Azure OpenAI 服務無法連接');
      }
      return isHealthy;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Azure OpenAI 健康檢查失敗';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendMessage,
    sendMessages,
    sendStreamMessage,
    transcribeAudio,
    isLoading,
    error,
    lastResponse,
    clearError,
    checkHealth,
  };
}