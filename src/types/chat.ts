// Session resumption support for Live API
export interface ChatRoomSession {
  sessionHandle: string | null;
  lastConnected: Date | null;
  isResumable: boolean;
}

// 按照 CLAUDE.md 規範的 ChatRoom 介面
export interface ChatRoom {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  messages: Message[];
  config?: any; // LiveConnectConfig from @google/genai - 將在整合 Live API 時定義
  isActive: boolean;
  session?: ChatRoomSession; // Session resumption data
}

// 按照 CLAUDE.md 規範的 Message 介面
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  isTranscribing?: boolean;
  transcription?: string;
  isTyping?: boolean; // 標記是否正在打字中（用於打字機效果）
  // Real-time transcription state for ongoing messages
  realtimeTranscription?: {
    currentText: string;
    isFinal: boolean;
    isProcessing: boolean;
  };
}

// 按照 CLAUDE.md 規範的 API 介面
export interface ChatRoomAPI {
  getChatRooms(): Promise<ChatRoom[]>;
  createChatRoom(name: string): Promise<ChatRoom>;
  deleteChatRoom(id: string): Promise<void>;
  switchToRoom(id: string): Promise<ChatRoom>;
  saveMessage(roomId: string, message: Message): Promise<void>;
}

export interface TranscriptionAPI {
  startTranscription(config?: any): Promise<void>;
  stopTranscription(): Promise<void>;
  getCurrentTranscript(): string;
  on(event: 'transcription', callback: (text: string) => void): void;
}

// Real-time audio input API for Live API integration
export interface RealtimeAudioAPI {
  // Send real-time audio chunks
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>): Promise<void>;
  // Send audio blob (convenience method)
  sendAudioBlob(audioBlob: Blob): Promise<void>;
  // Send base64 encoded audio data
  sendAudioData(audioData: string): Promise<void>;
}

// 保留工具呼叫介面（在整合 Live API 時會用到）
export interface ToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  timestamp: Date;
}