/**
 * Gemini Speech-to-Text Service for React Frontend
 * Uses official Gemini Audio API for high-quality speech recognition
 * Supports segmented recording for near real-time transcription
 */

import { GoogleGenAI } from "@google/genai";

// Supported audio formats for Gemini Audio API
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/wav', 'audio/mp3', 'audio/aiff', 
  'audio/aac', 'audio/ogg', 'audio/flac'
] as const;

export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

export interface GeminiSTTConfig {
  /** API key for accessing the Google Generative AI service */
  apiKey: string;
  /** Audio recording format (default: wav) */
  audioFormat?: SupportedAudioFormat;
  /** Recording segment duration in seconds (default: 3) */
  segmentDuration?: number;
  /** Sample rate for audio recording (default: 16000) */
  sampleRate?: number;
  /** Whether to enable logging */
  enableLogging?: boolean;
  /** Custom transcription prompt */
  transcriptionPrompt?: string;
}

export interface STTResult {
  /** The transcribed text */
  transcript: string;
  /** Whether this is a final result */
  isFinal: boolean;
  /** Segment index */
  segmentIndex: number;
  /** Confidence level (estimated) */
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
}

/**
 * Service class for Speech-to-Text conversion using Gemini Audio API.
 * Provides segmented recording for near real-time transcription.
 */
export class GeminiSTTService {
  private readonly client: GoogleGenAI;
  private readonly config: Required<Omit<GeminiSTTConfig, 'apiKey'>>;
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private events: Partial<STTEvents> = {};
  private currentSegmentIndex: number = 0;
  private recordedChunks: Blob[] = [];
  private segmentTimer: NodeJS.Timeout | null = null;

  /**
   * Creates a new GeminiSTTService instance.
   * @param config - Configuration options for the STT service.
   */
  constructor(config: GeminiSTTConfig) {
    if (!config.apiKey) {
      throw new Error("API key is missing. Please provide a valid API key.");
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    
    // Default configuration
    this.config = {
      audioFormat: config.audioFormat ?? 'audio/wav',
      segmentDuration: config.segmentDuration ?? 3,
      sampleRate: config.sampleRate ?? 16000,
      enableLogging: config.enableLogging ?? false,
      transcriptionPrompt: config.transcriptionPrompt ?? 'Please transcribe this audio to text.'
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
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: this.getSupportedMimeType()
      };

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      this.setupMediaRecorder();

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      this.startSegmentTimer();

      this.log('Started Gemini STT recognition');
      this.events.onStart?.();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
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

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.log('Stopped Gemini STT recognition');
    this.events.onEnd?.();
  }

  /**
   * Sets up MediaRecorder event handlers.
   */
  private setupMediaRecorder(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      if (this.recordedChunks.length > 0) {
        await this.processAudioSegment();
      }
    };

    this.mediaRecorder.onerror = (event) => {
      this.log(`MediaRecorder error: ${event.error}`);
      this.events.onError?.(`Recording error: ${event.error}`);
    };
  }

  /**
   * Starts the segment timer for automatic segmentation.
   */
  private startSegmentTimer(): void {
    if (!this.isRecording) return;

    this.segmentTimer = setTimeout(() => {
      if (this.isRecording && this.mediaRecorder) {
        this.processCurrentSegment();
      }
    }, this.config.segmentDuration * 1000);
  }

  /**
   * Processes the current audio segment.
   */
  private async processCurrentSegment(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecording) return;

    this.log(`Processing segment ${this.currentSegmentIndex}`);
    this.events.onSegmentStart?.(this.currentSegmentIndex);

    // Stop current recording to trigger processing
    this.mediaRecorder.stop();

    // Start new recording for next segment
    setTimeout(() => {
      if (this.isRecording && this.audioStream) {
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
          mimeType: this.getSupportedMimeType()
        });
        this.setupMediaRecorder();
        this.mediaRecorder.start();
        this.startSegmentTimer();
      }
    }, 100);
  }

  /**
   * Processes recorded audio segment using Gemini Audio API.
   */
  private async processAudioSegment(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Create audio blob
      const audioBlob = new Blob(this.recordedChunks, { 
        type: this.config.audioFormat 
      });

      if (audioBlob.size === 0) {
        this.log('Empty audio segment, skipping');
        return;
      }

      // Convert to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      this.log([
        `Processing audio segment ${this.currentSegmentIndex}`,
        `Size: ${audioBlob.size} bytes`,
        `Format: ${this.config.audioFormat}`
      ]);

      // Call Gemini Audio API
      const result = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: 'user',
          parts: [
            { 
              text: this.config.transcriptionPrompt 
            },
            {
              inlineData: {
                mimeType: this.config.audioFormat,
                data: base64Audio,
              },
            },
          ]
        }]
      });

      const transcript = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const processingTime = Date.now() - startTime;

      if (transcript && transcript.length > 0) {
        const sttResult: STTResult = {
          transcript,
          isFinal: true,
          segmentIndex: this.currentSegmentIndex,
          confidence: 0.9, // Gemini doesn't provide confidence scores
          processingTime
        };

        this.log([
          `Transcription complete for segment ${this.currentSegmentIndex}`,
          `Text: "${transcript}"`,
          `Processing time: ${processingTime}ms`
        ]);

        this.events.onResult?.(sttResult);
      }

      this.events.onSegmentEnd?.(this.currentSegmentIndex);
      this.currentSegmentIndex++;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Error processing audio segment: ${errorMessage}`);
      this.events.onError?.(`Transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Converts Blob to base64 string.
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Gets the best supported MIME type for recording.
   */
  private getSupportedMimeType(): string {
    // Check browser support for different formats
    const formatMap = {
      'audio/wav': 'audio/wav',
      'audio/webm;codecs=opus': 'audio/ogg',
      'audio/mp4': 'audio/aac',
      'audio/ogg;codecs=opus': 'audio/ogg'
    };

    for (const [mimeType, apiFormat] of Object.entries(formatMap)) {
      if (MediaRecorder.isTypeSupported(mimeType) && apiFormat === this.config.audioFormat) {
        return mimeType;
      }
    }

    // Fallback to most compatible format
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    
    return 'audio/wav';
  }

  /**
   * Checks if the browser supports MediaRecorder.
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && 
           typeof navigator.mediaDevices?.getUserMedia !== 'undefined';
  }

  /**
   * Gets supported audio formats.
   */
  static getSupportedFormats(): SupportedAudioFormat[] {
    return [...SUPPORTED_AUDIO_FORMATS];
  }

  /**
   * Checks if currently recording.
   */
  isRecognizing(): boolean {
    return this.isRecording;
  }

  /**
   * Updates the configuration.
   */
  updateConfig(newConfig: Partial<Omit<GeminiSTTConfig, 'apiKey'>>): void {
    Object.assign(this.config, newConfig);
    this.log('Configuration updated');
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): Required<Omit<GeminiSTTConfig, 'apiKey'>> {
    return { ...this.config };
  }

  /**
   * Logs information if logging is enabled.
   */
  private log(info: string | string[]): void {
    if (!this.config.enableLogging) return;

    const logMessage = Array.isArray(info)
      ? info.map((line) => `* ${line}`).join("\n")
      : `* ${info}`;

    console.log(`[DEBUG GeminiSTTService]\n${logMessage}`);
  }
}