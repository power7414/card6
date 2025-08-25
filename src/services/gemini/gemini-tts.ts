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
  /** Optional callbacks for playback events */
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
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
      this.log(`TTS API Key available: ${!!this.client}`);
      this.log(`TTS Model: ${this.defaultConfig.model}`);

      // Merge options with defaults
      const voiceName = options.voice?.voiceName ?? this.defaultConfig.voice.voiceName;
      const stylePrompt = options.voice?.stylePrompt ?? this.defaultConfig.voice.stylePrompt;
      
      this.log(`TTS Voice: ${voiceName}, Style: ${stylePrompt}`);

      // Prepare the text with style prompt if provided
      const textContent = stylePrompt 
        ? `${stylePrompt}: ${options.text}`
        : options.text;

      this.log([
        `Using voice: ${voiceName}`,
        `Style prompt: ${stylePrompt || 'None'}`,
        `Model: ${this.defaultConfig.model}`
      ]);

      // Call Gemini TTS API - format matches official documentation
      const result = await this.client.models.generateContent({
        model: this.defaultConfig.model,
        contents: [{ 
          parts: [{ text: textContent }] 
        }], // No 'role' property for TTS models
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          }
        }
      });

      // Debug: Log the complete API response structure
      this.log('=== Complete TTS API Response Debug ===');
      this.log(`Response has result: ${!!result}`);
      this.log(`Response keys: ${result ? Object.keys(result).join(', ') : 'none'}`);
      
      if (result?.candidates) {
        this.log(`Candidates length: ${result.candidates.length}`);
        if (result.candidates[0]) {
          this.log(`First candidate keys: ${Object.keys(result.candidates[0]).join(', ')}`);
          
          if (result.candidates[0].content) {
            this.log(`Content keys: ${Object.keys(result.candidates[0].content).join(', ')}`);
            
            if (result.candidates[0].content.parts) {
              this.log(`Parts length: ${result.candidates[0].content.parts.length}`);
              result.candidates[0].content.parts.forEach((part: any, index: number) => {
                this.log(`Part ${index} keys: ${Object.keys(part).join(', ')}`);
                if (part.inlineData) {
                  this.log(`Part ${index} inlineData keys: ${Object.keys(part.inlineData).join(', ')}`);
                  this.log(`Part ${index} has data: ${!!part.inlineData.data}`);
                  if (part.inlineData.data) {
                    this.log(`Part ${index} data length: ${part.inlineData.data.length}`);
                  }
                }
              });
            }
          }
        }
      }
      
      // Log the raw response for debugging
      this.log('Raw response (first 500 chars):');
      this.log(JSON.stringify(result, null, 2).substring(0, 500));

      // Extract audio data from response
      if (!result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        this.log('❌ No audio data found at expected path');
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
   * @returns Promise that resolves when audio playback completes
   */
  async speakText(options: TTSOptions): Promise<HTMLAudioElement> {
    try {
      this.log(`Starting TTS playback for: "${options.text.substring(0, 30)}..."`);
      
      const audioBlob = await this.textToSpeech(options);
      
      // Create proper WAV blob with header for better compatibility
      const wavBlob = await this.addWavHeader(audioBlob);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      const audio = new Audio(audioUrl);
      
      // Set audio properties for better playback
      audio.volume = 1.0;
      audio.preload = 'auto';
      
      return new Promise((resolve, reject) => {
        // Clean up when audio ends or fails
        const cleanup = () => {
          URL.revokeObjectURL(audioUrl);
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
          audio.removeEventListener('loadeddata', onLoadedData);
        };

        const onEnded = () => {
          this.log('✅ Audio playback completed successfully');
          if (options.onEnd) {
            try {
              options.onEnd();
            } catch (callbackError) {
              console.warn('TTS onEnd callback error:', callbackError);
            }
          }
          cleanup();
          resolve(audio);
        };

        const onError = () => {
          const errorMsg = audio.error?.message || 'Unknown audio error';
          this.log(`❌ Audio playback error: ${errorMsg}`);
          if (options.onError) {
            try {
              options.onError(errorMsg);
            } catch (callbackError) {
              console.warn('TTS onError callback error:', callbackError);
            }
          }
          cleanup();
          reject(new Error(`Audio playback failed: ${errorMsg}`));
        };

        const onLoadedData = async () => {
          try {
            this.log('🎵 Starting audio playback...');
            await audio.play();
            this.log('✅ Audio playback started successfully');
            if (options.onStart) {
              try {
                options.onStart();
              } catch (callbackError) {
                console.warn('TTS onStart callback error:', callbackError);
              }
            }
            // Audio started successfully - onEnded will handle completion
          } catch (playError: any) {
            this.log(`⚠️  Autoplay blocked by browser: ${playError.message}`);
            // For autoplay blocked case, call onError callback
            if (options.onError) {
              try {
                options.onError(`Autoplay blocked: ${playError.message}`);
              } catch (callbackError) {
                console.warn('TTS onError callback error:', callbackError);
              }
            }
            cleanup();
            resolve(audio);
          }
        };

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.addEventListener('loadeddata', onLoadedData);

        // Start loading the audio
        audio.load();
      });

    } catch (error) {
      this.log(`❌ Error in speakText: ${error}`);
      throw new Error(`Failed to speak text: ${error}`);
    }
  }

  /**
   * Adds WAV header to raw PCM audio data for better browser compatibility.
   * Gemini TTS returns raw PCM at 24kHz, 16-bit, mono.
   * @param rawAudioBlob - Raw PCM audio blob
   * @returns WAV formatted blob
   */
  private async addWavHeader(rawAudioBlob: Blob): Promise<Blob> {
    const sampleRate = 24000; // Gemini TTS outputs at 24kHz
    const bitsPerSample = 16;
    const channels = 1; // mono
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    const rawBuffer = await rawAudioBlob.arrayBuffer();
    const rawArray = new Uint8Array(rawBuffer);
    const wavHeaderLength = 44;
    const totalLength = wavHeaderLength + rawArray.length;
    
    const wavBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(wavBuffer);
    
    // WAV file header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF'); // ChunkID
    view.setUint32(4, totalLength - 8, true); // ChunkSize
    writeString(8, 'WAVE'); // Format
    writeString(12, 'fmt '); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, channels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample
    writeString(36, 'data'); // Subchunk2ID
    view.setUint32(40, rawArray.length, true); // Subchunk2Size
    
    // Copy raw audio data
    const wavArray = new Uint8Array(wavBuffer);
    wavArray.set(rawArray, wavHeaderLength);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
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
    // Voice configuration updated silently
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