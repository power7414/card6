// Conversation Types
export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'audio';
  timestamp: Date;
  audioData?: ArrayBuffer;
  transcription?: string;
}

export interface ConversationState {
  currentThread: Thread | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  inputMode: 'text' | 'push-to-talk' | 'continuous';
  isRecording: boolean;
  isPlaying: boolean;
  voiceSettings: {
    speed: number;
    volume: number;
    voice?: string;
  };
}

export interface CreateThreadRequest {
  title?: string;
}

export interface SendMessageRequest {
  threadId: string;
  content: string;
  type: 'text' | 'audio';
  audioData?: ArrayBuffer;
}