// WebSocket Event Types
export interface SocketEvents {
  // Client to Server
  'join-thread': { threadId: string };
  'leave-thread': { threadId: string };
  'send-message': {
    threadId: string;
    content: string;
    type: 'text' | 'audio';
    audioData?: ArrayBuffer;
  };
  'start-recording': { threadId: string };
  'stop-recording': { threadId: string };
  'audio-chunk': {
    threadId: string;
    audioData: ArrayBuffer;
  };

  // Server to Client
  'message-received': {
    id: string;
    threadId: string;
    role: 'user' | 'assistant';
    content: string;
    type: 'text' | 'audio';
    timestamp: Date;
    audioData?: ArrayBuffer;
    transcription?: string;
  };
  'transcription-update': {
    threadId: string;
    messageId: string;
    transcription: string;
  };
  'audio-response': {
    threadId: string;
    messageId: string;
    audioData: ArrayBuffer;
  };
  'error': {
    message: string;
    code?: string;
  };
  'thread-updated': {
    threadId: string;
    title: string;
    messageCount: number;
  };
}

// WebSocket Connection State
export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}