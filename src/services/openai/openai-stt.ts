/**
 * OpenAI Whisper Speech-to-Text Service for React Frontend
 * Uses OpenAI Whisper API for high-quality speech recognition with VAD support
 * Supports segmented recording and streaming transcription for near real-time results
 */

// Type declarations for webkit compatibility
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Supported audio formats for OpenAI Whisper API
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/webm', 
  'audio/mp4', 'audio/mpeg', 'audio/mpga'
] as const;

export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

export interface VADConfig {
  /** VAD detection threshold (0-1, default: 0.6) */
  threshold?: number;
  /** Silence duration in ms to trigger stop (default: 1500) */
  silenceDuration?: number;
  /** Padding before speech starts in ms (default: 300) */
  prefixPadding?: number;
  /** Minimum recording duration in ms (default: 500) */
  minRecordingDuration?: number;
}

export interface OpenAISTTConfig {
  /** API key for accessing OpenAI API */
  apiKey: string;
  /** Audio recording format (default: webm) */
  audioFormat?: SupportedAudioFormat;
  /** Recording segment duration in seconds (default: 5) */
  segmentDuration?: number;
  /** Sample rate for audio recording (default: 16000) */
  sampleRate?: number;
  /** Whether to enable logging */
  enableLogging?: boolean;
  /** Whisper model to use (default: gpt-4o-mini-transcribe for streaming) */
  model?: 'whisper-1' | 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe';
  /** Language code for transcription (optional, auto-detect if not provided) */
  language?: string;
  /** Response format (default: text for streaming models) */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  /** Temperature for randomness (0-1, default: 0) */
  temperature?: number;
  /** Enable streaming transcription (default: true) */
  enableStreaming?: boolean;
  /** VAD (Voice Activity Detection) configuration */
  vadConfig?: VADConfig;
}

export interface STTResult {
  /** The transcribed text */
  transcript: string;
  /** Whether this is a final result */
  isFinal: boolean;
  /** Segment index */
  segmentIndex: number;
  /** Confidence level (estimated, OpenAI doesn't provide this directly) */
  confidence: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

export interface STTEvents {
  onResult: (result: STTResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onSegmentStart?: (segmentIndex: number) => void;
  onSegmentEnd?: (segmentIndex: number) => void;
  // VAD Events
  onVADSpeechStart?: () => void;
  onVADSpeechEnd?: () => void;
  onVADVolumeChange?: (volume: number) => void;
  // Streaming Events
  onStreamingResult?: (partialResult: string) => void;
}

/**
 * Service class for Speech-to-Text conversion using OpenAI Whisper API.
 * Provides segmented recording for near real-time transcription.
 */
export class OpenAISTTService {
  private readonly config: Required<Omit<OpenAISTTConfig, 'apiKey' | 'language' | 'vadConfig'>> & { 
    language?: string;
    vadConfig: Required<VADConfig>;
  };
  private readonly apiKey: string;
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private events: Partial<STTEvents> = {};
  private currentSegmentIndex: number = 0;
  private recordedChunks: Blob[] = [];
  private segmentTimer: NodeJS.Timeout | null = null;
  
  // VAD related properties
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer: NodeJS.Timeout | null = null;
  private isSpeaking: boolean = false;
  private silenceStartTime: number = 0;
  private recordingStartTime: number = 0;

  /**
   * Creates a new OpenAISTTService instance.
   * @param config - Configuration options for the STT service.
   */
  constructor(config: OpenAISTTConfig) {
    if (!config.apiKey) {
      throw new Error("API key is missing. Please provide a valid OpenAI API key.");
    }

    this.apiKey = config.apiKey;
    
    // Default configuration
    this.config = {
      audioFormat: config.audioFormat ?? 'audio/webm',
      segmentDuration: config.segmentDuration ?? 5,
      sampleRate: config.sampleRate ?? 16000,
      enableLogging: config.enableLogging ?? false,
      model: config.model ?? 'gpt-4o-mini-transcribe', // Use streaming-capable model by default
      language: config.language,
      responseFormat: config.responseFormat ?? 'text', // Text format for streaming
      temperature: config.temperature ?? 0,
      enableStreaming: config.enableStreaming ?? true,
      vadConfig: {
        threshold: config.vadConfig?.threshold ?? 0.6,
        silenceDuration: config.vadConfig?.silenceDuration ?? 1500,
        prefixPadding: config.vadConfig?.prefixPadding ?? 300,
        minRecordingDuration: config.vadConfig?.minRecordingDuration ?? 500
      }
    };
  }

  /**
   * Starts speech recognition with segmented recording.
   * @param events - Event handlers for recognition events
   */
  async startRecognition(events: STTEvents): Promise<void> {
    if (this.isRecording) {
      this.log('Recognition is already running');
      return;
    }

    this.events = events;
    this.currentSegmentIndex = 0;
    this.recordedChunks = [];

    try {
      // Get user media
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup AudioContext for VAD
      await this.setupVAD(this.audioStream);

      // Setup MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: this.config.audioFormat,
        audioBitsPerSecond: 128000
      };

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processSegment();
      };

      // Start recording
      this.isRecording = true;
      this.events.onStart?.();
      this.startSegmentRecording();
      
      this.log('STT recognition started');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recognition';
      this.log(`Error starting recognition: ${errorMessage}`);
      this.events.onError?.(errorMessage);
    }
  }

  /**
   * Stops speech recognition.
   */
  stopRecognition(): void {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;
    
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
      this.segmentTimer = null;
    }

    // Stop VAD monitoring
    this.stopVAD();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.events.onEnd?.();
    this.log('STT recognition stopped');
  }

  /**
   * Starts recording a new segment.
   */
  private startSegmentRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      return;
    }

    this.recordedChunks = [];
    this.events.onSegmentStart?.(this.currentSegmentIndex);
    
    this.mediaRecorder.start();
    
    // Schedule segment processing
    this.segmentTimer = setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
    }, this.config.segmentDuration * 1000);

    this.log(`Started recording segment ${this.currentSegmentIndex}`);
  }

  /**
   * Processes a completed audio segment.
   */
  private async processSegment(): Promise<void> {
    if (this.recordedChunks.length === 0) {
      if (this.isRecording) {
        this.scheduleNextSegment();
      }
      return;
    }

    const segmentIndex = this.currentSegmentIndex;
    const startTime = Date.now();

    try {
      this.events.onSegmentEnd?.(segmentIndex);
      
      // Create audio blob from recorded chunks
      const audioBlob = new Blob(this.recordedChunks, { 
        type: this.config.audioFormat 
      });
      
      this.log([
        `Processing audio segment ${segmentIndex}`,
        `Size: ${audioBlob.size} bytes`,
        `Format: ${this.config.audioFormat}`
      ]);

      // Call OpenAI Whisper API
      const transcript = await this.transcribeAudio(audioBlob);
      const processingTime = Date.now() - startTime;

      if (transcript && transcript.trim().length > 0) {
        const sttResult: STTResult = {
          transcript: transcript.trim(),
          isFinal: true, // OpenAI Whisper always returns final results
          segmentIndex,
          confidence: 0.9, // OpenAI doesn't provide confidence, use estimated high value
          processingTime
        };

        this.events.onResult?.(sttResult);
        this.log(`Segment ${segmentIndex} transcribed: "${transcript}"`);
      } else {
        this.log(`Segment ${segmentIndex}: No speech detected`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      this.log(`Error processing segment ${segmentIndex}: ${errorMessage}`);
      this.events.onError?.(errorMessage);
    } finally {
      this.currentSegmentIndex++;
      
      if (this.isRecording) {
        this.scheduleNextSegment();
      }
    }
  }

  /**
   * Schedules the next segment recording.
   */
  private scheduleNextSegment(): void {
    // Small delay before starting next segment to avoid overlap
    setTimeout(() => {
      if (this.isRecording) {
        this.startSegmentRecording();
      }
    }, 100);
  }

  /**
   * Sets up Voice Activity Detection using Web Audio API.
   * @param stream - MediaStream to analyze
   */
  private async setupVAD(stream: MediaStream): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser for VAD
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      
      // Start VAD monitoring
      this.startVADMonitoring();
      
      this.log('VAD setup completed');
    } catch (error) {
      this.log(`VAD setup failed: ${error}`);
      throw error;
    }
  }

  /**
   * Starts monitoring audio volume for voice activity detection.
   */
  private startVADMonitoring(): void {
    if (!this.analyser) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!this.isRecording || !this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const volume = rms / 255; // Normalize to 0-1
      
      this.events.onVADVolumeChange?.(volume);
      
      // VAD logic
      const isSpeechDetected = volume > this.config.vadConfig.threshold;
      
      if (isSpeechDetected && !this.isSpeaking) {
        // Speech started
        this.handleSpeechStart();
      } else if (!isSpeechDetected && this.isSpeaking) {
        // Potential speech end - start silence timer
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = Date.now();
        } else if (Date.now() - this.silenceStartTime > this.config.vadConfig.silenceDuration) {
          // Silence duration exceeded - speech ended
          this.handleSpeechEnd();
        }
      } else if (isSpeechDetected && this.isSpeaking) {
        // Speech continuing - reset silence timer
        this.silenceStartTime = 0;
      }
      
      this.vadTimer = setTimeout(checkAudioLevel, 50); // Check every 50ms
    };
    
    checkAudioLevel();
  }

  /**
   * Handles the start of speech detection.
   */
  private handleSpeechStart(): void {
    this.isSpeaking = true;
    this.silenceStartTime = 0;
    this.recordingStartTime = Date.now();
    
    this.log('Speech detected - starting recording');
    this.events.onVADSpeechStart?.();
    
    // Start actual recording with prefix padding
    setTimeout(() => {
      if (this.isSpeaking) {
        this.startSegmentRecording();
      }
    }, this.config.vadConfig.prefixPadding);
  }

  /**
   * Handles the end of speech detection.
   */
  private handleSpeechEnd(): void {
    const recordingDuration = Date.now() - this.recordingStartTime;
    
    // Only process if minimum recording duration is met
    if (recordingDuration >= this.config.vadConfig.minRecordingDuration) {
      this.log('Speech ended - processing recording');
      this.events.onVADSpeechEnd?.();
      
      // Stop current recording and process
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
    } else {
      this.log('Recording too short - discarding');
    }
    
    this.isSpeaking = false;
    this.silenceStartTime = 0;
  }

  /**
   * Stops VAD monitoring and cleanup.
   */
  private stopVAD(): void {
    if (this.vadTimer) {
      clearTimeout(this.vadTimer);
      this.vadTimer = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.isSpeaking = false;
    this.silenceStartTime = 0;
  }

  /**
   * Transcribes audio using OpenAI Whisper API with streaming support.
   * @param audioBlob - Audio blob to transcribe
   * @returns Transcribed text
   */
  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    
    // Convert blob to file with proper extension
    const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
      type: this.config.audioFormat
    });
    
    formData.append('file', audioFile);
    formData.append('model', this.config.model);
    formData.append('response_format', this.config.responseFormat);
    formData.append('temperature', this.config.temperature.toString());
    
    if (this.config.language) {
      formData.append('language', this.config.language);
    }

    // Enable streaming for supported models
    if (this.config.enableStreaming && this.supportsStreaming()) {
      formData.append('stream', 'true');
      return this.handleStreamingResponse(formData);
    } else {
      return this.handleRegularResponse(formData);
    }
  }

  /**
   * Handles regular (non-streaming) transcription response.
   */
  private async handleRegularResponse(formData: FormData): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (this.config.responseFormat === 'json' || this.config.responseFormat === 'verbose_json') {
      return result.text || '';
    } else {
      return result || '';
    }
  }

  /**
   * Handles streaming transcription response.
   */
  private async handleStreamingResponse(formData: FormData): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    let fullTranscript = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response stream available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'transcript.text.delta' && data.delta) {
                // Partial result - emit streaming event
                fullTranscript += data.delta;
                this.events.onStreamingResult?.(fullTranscript);
                this.log(`Streaming transcript: "${data.delta}"`);
              } else if (data.type === 'transcript.text.done') {
                // Final result
                fullTranscript = data.text || fullTranscript;
                this.log(`Final transcript: "${fullTranscript}"`);
              }
            } catch (e) {
              this.log(`Error parsing streaming response: ${e}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullTranscript;
  }

  /**
   * Checks if the current model supports streaming.
   */
  private supportsStreaming(): boolean {
    return this.config.model === 'gpt-4o-mini-transcribe' || 
           this.config.model === 'gpt-4o-transcribe';
  }

  /**
   * Checks if the service is supported in the current browser.
   * @returns boolean indicating support
   */
  static isSupported(): boolean {
    try {
      return !!(navigator.mediaDevices && 
                typeof navigator.mediaDevices.getUserMedia === 'function' && 
                'MediaRecorder' in window);
    } catch {
      return false;
    }
  }

  /**
   * Gets supported audio formats by the browser.
   * @returns Array of supported audio MIME types
   */
  static getSupportedAudioFormats(): string[] {
    if (!('MediaRecorder' in window)) {
      return [];
    }

    return SUPPORTED_AUDIO_FORMATS.filter(format => {
      try {
        return MediaRecorder.isTypeSupported(format);
      } catch {
        return false;
      }
    });
  }

  /**
   * Logs information if logging is enabled.
   * @param info - Information to be logged. Can be a string or an array of strings.
   */
  private log(info: string | string[]): void {
    if (!this.config.enableLogging) return;

    const logMessage = Array.isArray(info)
      ? info.map((line) => `* ${line}`).join("\n")
      : `* ${info}`;

    console.log(`[DEBUG OpenAISTTService]\n${logMessage}`);
  }
}