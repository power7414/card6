/**
 * Gemini Text-to-Speech Service for React Frontend
 * Implements real Gemini TTS API using gemini-2.5-flash-preview-tts model
 * Supports high-quality speech synthesis with multiple voice options
 */

import { GoogleGenAI } from "@google/genai";

// Available Gemini TTS voices
export const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede',
  'Arcas', 'Callisto', 'Dione', 'Ganymede', 'Himalia', 'Iapetus',
  'Io', 'Leda', 'Lysithea', 'Oberon', 'Rhea', 'Titan',
  'Triton', 'Umbriel', 'Europa', 'Enceladus', 'Hyperion', 'Miranda',
  'Nereid', 'Pandora', 'Prometheus', 'Tethys', 'Thebe', 'Titania'
] as const;

export type GeminiVoiceName = typeof GEMINI_VOICES[number];

export interface GeminiTTSConfig {
  /** API key for accessing the Google Generative AI service. */
  apiKey: string;
  /** Whether to enable logging. Defaults to false. */
  enableLogging?: boolean;
  /** Voice settings */
  voice?: {
    /** Predefined voice name (e.g., 'Kore', 'Zephyr', 'Puck', 'Charon') */
    voiceName?: GeminiVoiceName;
    /** Custom voice style prompt */
    stylePrompt?: string;
  };
  /** TTS model to use */
  model?: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
}

export interface TTSOptions {
  /** The text to be converted to speech */
  text: string;
  /** Voice settings for this specific request */
  voice?: {
    /** Predefined voice name */
    voiceName?: GeminiVoiceName;
    /** Custom voice style prompt */
    stylePrompt?: string;
  };
}

/**
 * Service class for converting text to speech using Gemini TTS API.
 * Provides high-quality audio generation with multiple voice options.
 */
export class GeminiTTSService {
  private readonly client: GoogleGenAI;
  private readonly enableLogging: boolean;
  private readonly defaultConfig: Required<Omit<GeminiTTSConfig, 'apiKey' | 'enableLogging'>>;

  /**
   * Creates a new GeminiTTSService instance.
   * @param config - Configuration options for the TTS service.
   * @throws {Error} If the API key is missing.
   */
  constructor(config: GeminiTTSConfig) {
    if (!config.apiKey) {
      throw new Error("API key is missing. Please provide a valid API key.");
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.enableLogging = config.enableLogging ?? false;
    
    // Default configuration
    this.defaultConfig = {
      model: config.model ?? 'gemini-2.5-flash-preview-tts',
      voice: {
        voiceName: config.voice?.voiceName ?? 'Kore',
        stylePrompt: config.voice?.stylePrompt
      }
    };
  }

  /**
   * Converts text to speech using Gemini TTS API and returns an audio blob.
   * 
   * @param options - Options for text-to-speech conversion
   * @returns Promise that resolves to an audio Blob
   */
  async textToSpeech(options: TTSOptions): Promise<Blob> {
    try {
      this.log(`Converting text to speech: "${options.text.substring(0, 50)}..."`);

      // Merge options with defaults
      const voiceName = options.voice?.voiceName ?? this.defaultConfig.voice.voiceName;
      const stylePrompt = options.voice?.stylePrompt ?? this.defaultConfig.voice.stylePrompt;

      // Prepare the text with style prompt if provided
      const textContent = stylePrompt 
        ? `${stylePrompt}: ${options.text}`
        : options.text;

      this.log([
        `Using voice: ${voiceName}`,
        `Style prompt: ${stylePrompt || 'None'}`,
        `Model: ${this.defaultConfig.model}`
      ]);

      // Call Gemini TTS API
      const result = await this.client.models.generateContent({
        model: this.defaultConfig.model,
        contents: [{ parts: [{ text: textContent }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          },
        },
      });

      // Extract audio data from response
      if (!result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        throw new Error('No audio data received from Gemini TTS API');
      }

      const audioBase64 = result.candidates[0].content.parts[0].inlineData.data;
      
      // Convert base64 to blob
      const audioBlob = this.base64ToBlob(audioBase64, 'audio/wav');
      
      this.log(`Successfully generated audio (${audioBlob.size} bytes)`);
      return audioBlob;

    } catch (error) {
      this.log(`Error generating speech: ${error}`);
      throw new Error(`Failed to generate speech: ${error}`);
    }
  }

  /**
   * Converts text to speech and plays it immediately.
   * @param options - Options for text-to-speech conversion
   * @returns Promise that resolves when audio starts playing
   */
  async speakText(options: TTSOptions): Promise<HTMLAudioElement> {
    try {
      const audioBlob = await this.textToSpeech(options);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      
      // Clean up object URL when audio ends
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      });

      // Auto-play the audio
      await audio.play();
      this.log('Audio playback started');
      return audio;

    } catch (error) {
      this.log(`Error playing audio: ${error}`);
      throw new Error(`Failed to play audio: ${error}`);
    }
  }

  /**
   * Converts base64 string to Blob.
   * @param base64 - Base64 encoded string
   * @param mimeType - MIME type for the blob
   * @returns Blob object
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Gets available voice names.
   * @returns Array of available voice names
   */
  static getAvailableVoices(): GeminiVoiceName[] {
    return [...GEMINI_VOICES];
  }

  /**
   * Checks if the browser supports audio playback.
   * @returns boolean indicating audio support
   */
  static isAudioSupported(): boolean {
    return typeof Audio !== 'undefined';
  }

  /**
   * Gets supported audio formats by the browser.
   * @returns Array of supported audio MIME types
   */
  static getSupportedAudioFormats(): string[] {
    if (!GeminiTTSService.isAudioSupported()) {
      return [];
    }

    const audio = new Audio();
    const formats = ['wav', 'mp3', 'ogg'];
    
    return formats.filter(format => {
      const mimeType = `audio/${format}`;
      return audio.canPlayType(mimeType) !== '';
    });
  }

  /**
   * Updates the default voice configuration.
   * @param voice - New voice configuration
   */
  updateVoiceConfig(voice: Partial<GeminiTTSConfig['voice']>): void {
    if (voice?.voiceName) {
      this.defaultConfig.voice.voiceName = voice.voiceName;
    }
    if (voice?.stylePrompt !== undefined) {
      this.defaultConfig.voice.stylePrompt = voice.stylePrompt;
    }
    this.log('Voice configuration updated');
  }

  /**
   * Gets the current voice configuration.
   * @returns Current voice configuration
   */
  getVoiceConfig(): Required<GeminiTTSConfig>['voice'] {
    return { ...this.defaultConfig.voice };
  }

  /**
   * Logs information if logging is enabled.
   * @param info - Information to be logged. Can be a string or an array of strings.
   */
  private log(info: string | string[]): void {
    if (!this.enableLogging) return;

    const logMessage = Array.isArray(info)
      ? info.map((line) => `* ${line}`).join("\n")
      : `* ${info}`;

    console.log(`[DEBUG GeminiTTSService]\n${logMessage}`);
  }
}

