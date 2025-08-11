export interface TranscriptionState {
  currentTranscript: string;
  isTranscribing: boolean;
  status: 'idle' | 'recording' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface TranscriptionSegment {
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
}

// Live API transcription event data structure
export interface LiveTranscriptionEvent {
  text: string;
  isFinal?: boolean;
}

// Configuration for transcription features
export interface TranscriptionConfig {
  input_audio_transcription?: {};
  output_audio_transcription?: {};
}

// Transcription APIs for integration with Live API
export interface LiveTranscriptionAPI {
  // Start transcribing user input
  startInputTranscription(): void;
  // Stop transcribing user input
  stopInputTranscription(): void;
  // Clear all transcription data
  clearTranscriptions(): void;
  // Get current input transcription state
  getInputTranscriptionState(): TranscriptionState;
  // Get current output transcription state  
  getOutputTranscriptionState(): TranscriptionState;
}