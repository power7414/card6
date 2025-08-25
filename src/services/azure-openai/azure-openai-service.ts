/**
 * Azure OpenAI API 服務
 * 支援 Chat Completions, Whisper STT 等功能
 */

import { azureOpenAIConfig, createAzureOpenAIUrl, createAzureOpenAIHeaders } from './azure-openai-config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface WhisperTranscriptionRequest {
  file: File;
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface WhisperTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export class AzureOpenAIService {
  private config = azureOpenAIConfig;

  constructor(customConfig?: Partial<typeof azureOpenAIConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  /**
   * Chat Completions API
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const url = createAzureOpenAIUrl(this.config, 'chat/completions');
    const headers = createAzureOpenAIHeaders(this.config);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Azure OpenAI API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Azure OpenAI Chat Completion Error:', error);
      throw error;
    }
  }

  /**
   * Whisper 語音轉文字 API
   */
  async transcribeAudio(request: WhisperTranscriptionRequest): Promise<WhisperTranscriptionResponse> {
    const url = createAzureOpenAIUrl(this.config, 'audio/transcriptions');
    const headers = {
      ...createAzureOpenAIHeaders(this.config),
    };
    
    // 移除 Content-Type header，讓瀏覽器自動設定 multipart/form-data
    delete headers['Content-Type'];

    const formData = new FormData();
    formData.append('file', request.file);
    
    if (request.model) formData.append('model', request.model);
    if (request.language) formData.append('language', request.language);
    if (request.prompt) formData.append('prompt', request.prompt);
    if (request.response_format) formData.append('response_format', request.response_format);
    if (request.temperature !== undefined) formData.append('temperature', request.temperature.toString());

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Azure OpenAI Whisper Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Azure OpenAI Whisper Transcription Error:', error);
      throw error;
    }
  }

  /**
   * 串流聊天完成
   */
  async chatCompletionStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const url = createAzureOpenAIUrl(this.config, 'chat/completions');
    const headers = createAzureOpenAIHeaders(this.config);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Azure OpenAI Stream Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Azure OpenAI Stream Chat Error:', error);
      onError(error as Error);
    }
  }

  /**
   * 檢查服務可用性
   */
  async checkHealth(): Promise<boolean> {
    try {
      const testRequest: ChatCompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      };
      
      await this.chatCompletion(testRequest);
      return true;
    } catch (error) {
      console.error('Azure OpenAI Health Check Failed:', error);
      return false;
    }
  }
}

// 預設匯出單例
export const azureOpenAIService = new AzureOpenAIService();