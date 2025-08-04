// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Google Live API Types
export interface GoogleLiveApiConfig {
  apiKey: string;
  model: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

export interface AudioConfig {
  inputFormat: 'pcm16' | 'wav';
  outputFormat: 'pcm16' | 'wav';
  sampleRate: number;
  channels: number;
}

export interface VoiceSettings {
  speed: number; // 0.5 - 2.0
  volume: number; // 0 - 100
  voice?: string;
}

// Input Types
export type InputMode = 'text' | 'push-to-talk' | 'continuous';

export interface TextMessage {
  type: 'text';
  content: string;
  timestamp: number;
}

export interface AudioMessage {
  type: 'audio';
  data: ArrayBuffer;
  timestamp: number;
}

export type Message = TextMessage | AudioMessage;