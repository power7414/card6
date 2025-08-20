/**
 * Speech-to-Text Service for React Frontend
 * Browser-compatible STT implementation using Web Speech API
 * Adapted from GTTS project concepts for frontend use
 */

export interface GeminiSTTConfig {
  /** Language code for speech recognition (e.g., 'zh-TW', 'en-US') */
  language?: string;
  /** Whether to enable continuous recognition */
  continuous?: boolean;
  /** Whether to return interim results */
  interimResults?: boolean;
  /** Maximum number of alternatives to return */
  maxAlternatives?: number;
  /** Whether to enable logging */
  enableLogging?: boolean;
}

export interface STTResult {
  /** The transcribed text */
  transcript: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Whether this is a final result */
  isFinal: boolean;
  /** Alternative transcriptions */
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

export interface STTEvents {
  onResult: (result: STTResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

/**
 * Service class for Speech-to-Text conversion using browser Web Speech API.
 * Provides real-time speech recognition capabilities.
 */
export class GeminiSTTService {
  private recognition: SpeechRecognition | null = null;
  private isRecognitionSupported: boolean;
  private isRecording: boolean = false;
  private readonly config: Required<GeminiSTTConfig>;
  private events: Partial<STTEvents> = {};

  /**
   * Creates a new GeminiSTTService instance.
   * @param config - Configuration options for the STT service.
   */
  constructor(config: GeminiSTTConfig = {}) {
    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isRecognitionSupported = !!SpeechRecognition;

    // Default configuration
    this.config = {
      language: config.language ?? 'zh-TW',
      continuous: config.continuous ?? true,
      interimResults: config.interimResults ?? true,
      maxAlternatives: config.maxAlternatives ?? 3,
      enableLogging: config.enableLogging ?? false,
    };

    if (this.isRecognitionSupported) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    } else {
      this.log('Web Speech API is not supported in this browser');
    }
  }

  /**
   * Sets up the speech recognition with configuration and event handlers.
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    // Configure recognition
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Event handlers
    this.recognition.onstart = () => {
      this.isRecording = true;
      this.log('Speech recognition started');
      this.events.onStart?.();
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      this.log('Speech recognition ended');
      this.events.onEnd?.();
    };

    this.recognition.onerror = (event) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      this.log(errorMessage);
      this.events.onError?.(errorMessage);
    };

    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };

    this.recognition.onspeechstart = () => {
      this.log('Speech detected');
      this.events.onSpeechStart?.();
    };

    this.recognition.onspeechend = () => {
      this.log('Speech ended');
      this.events.onSpeechEnd?.();
    };
  }

  /**
   * Handles speech recognition results.
   * @param event - SpeechRecognitionEvent
   */
  private handleSpeechResult(event: SpeechRecognitionEvent): void {
    const lastResult = event.results[event.results.length - 1];
    
    if (lastResult) {
      const result: STTResult = {
        transcript: lastResult[0].transcript,
        confidence: lastResult[0].confidence,
        isFinal: lastResult.isFinal,
        alternatives: Array.from(lastResult).map(alternative => ({
          transcript: alternative.transcript,
          confidence: alternative.confidence
        }))
      };

      this.log([
        `Transcript: ${result.transcript}`,
        `Confidence: ${result.confidence.toFixed(2)}`,
        `Final: ${result.isFinal}`
      ]);

      this.events.onResult?.(result);
    }
  }

  /**
   * Starts speech recognition.
   * @param events - Event handlers for recognition events
   * @throws {Error} If Web Speech API is not supported
   */
  public startRecognition(events: STTEvents): void {
    if (!this.isRecognitionSupported) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    if (this.isRecording) {
      this.log('Recognition is already running');
      return;
    }

    this.events = events;
    this.recognition?.start();
    this.log('Starting speech recognition');
  }

  /**
   * Stops speech recognition.
   */
  public stopRecognition(): void {
    if (!this.isRecognitionSupported || !this.isRecording) {
      return;
    }

    this.recognition?.stop();
    this.log('Stopping speech recognition');
  }

  /**
   * Aborts speech recognition immediately.
   */
  public abortRecognition(): void {
    if (!this.isRecognitionSupported) {
      return;
    }

    this.recognition?.abort();
    this.isRecording = false;
    this.log('Aborting speech recognition');
  }

  /**
   * Updates the recognition language.
   * @param language - Language code (e.g., 'zh-TW', 'en-US')
   */
  public setLanguage(language: string): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
    this.log(`Language set to: ${language}`);
  }

  /**
   * Checks if speech recognition is currently active.
   * @returns boolean indicating if recognition is recording
   */
  public isRecognizing(): boolean {
    return this.isRecording;
  }

  /**
   * Checks if the browser supports Web Speech API.
   * @returns boolean indicating support
   */
  public static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Gets available languages for speech recognition.
   * Note: This is a basic list. Actual support may vary by browser.
   * @returns Array of language codes
   */
  public static getSupportedLanguages(): string[] {
    return [
      'zh-TW', // Traditional Chinese (Taiwan)
      'zh-CN', // Simplified Chinese (China)
      'en-US', // English (US)
      'en-GB', // English (UK)
      'ja-JP', // Japanese
      'ko-KR', // Korean
      'es-ES', // Spanish
      'fr-FR', // French
      'de-DE', // German
      'it-IT', // Italian
      'pt-BR', // Portuguese (Brazil)
      'ru-RU', // Russian
      'ar-SA', // Arabic
      'hi-IN', // Hindi
      'th-TH'  // Thai
    ];
  }

  /**
   * Gets the current configuration.
   * @returns Current STT configuration
   */
  public getConfig(): Required<GeminiSTTConfig> {
    return { ...this.config };
  }

  /**
   * Updates the configuration.
   * @param newConfig - Partial configuration to update
   */
  public updateConfig(newConfig: Partial<GeminiSTTConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.recognition) {
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }

    this.log('Configuration updated');
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

    console.log(`[DEBUG GeminiSTTService]\n${logMessage}`);
  }
}

// Extend the Window interface to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
  
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    grammars: SpeechGrammarList;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    serviceURI: string;
    
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    
    abort(): void;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface SpeechGrammarList {
    readonly length: number;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
}

// Types are exported at declaration site