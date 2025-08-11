/**
 * Mock implementation of Google GenAI Live Client
 * 
 * Provides a complete mock of the GenAI Live API client for testing purposes.
 * Simulates real-time transcription, audio processing, and tool calls.
 */

import { EventEmitter } from 'eventemitter3';
import { LiveClientEventTypes } from '../lib/genai-live-client';

export interface MockLiveClientOptions {
  simulateLatency?: boolean;
  latencyRange?: [number, number];
  simulateErrors?: boolean;
  errorRate?: number;
}

export class MockGenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  private _status: "connected" | "disconnected" | "connecting" = "disconnected";
  private _session: any = null;
  private _model: string | null = null;
  private config: any = null;
  private options: MockLiveClientOptions;
  
  // Mock state
  private mockAudioContext: AudioContext | null = null;
  private simulationTimeouts: NodeJS.Timeout[] = [];
  private isSimulatingTranscription = false;

  constructor(options: MockLiveClientOptions = {}) {
    super();
    this.options = {
      simulateLatency: true,
      latencyRange: [100, 500],
      simulateErrors: false,
      errorRate: 0.1,
      ...options
    };
  }

  get status() {
    return this._status;
  }

  get session() {
    return this._session;
  }

  get model() {
    return this._model;
  }

  getConfig() {
    return { ...this.config };
  }

  async connect(model: string, config: any): Promise<boolean> {
    if (this._status === "connected" || this._status === "connecting") {
      return false;
    }

    this._status = "connecting";
    this.config = config;
    this._model = model;

    // Simulate connection delay
    await this.delay(this.getRandomLatency());

    // Simulate connection failure
    if (this.shouldSimulateError()) {
      this._status = "disconnected";
      const error = new ErrorEvent('error', {
        message: 'Mock connection failed'
      });
      setTimeout(() => this.emit('error', error), 10);
      return false;
    }

    this._session = {
      close: jest.fn(),
      sendRealtimeInput: jest.fn(),
      sendToolResponse: jest.fn(),
      sendClientContent: jest.fn()
    };

    this._status = "connected";
    
    // Emit connection events
    setTimeout(() => {
      this.emit('open');
      this.emit('setupcomplete');
    }, 10);

    return true;
  }

  disconnect(): boolean {
    if (!this._session) {
      return false;
    }

    this.clearSimulations();
    this._session = null;
    this._status = "disconnected";
    
    setTimeout(() => {
      this.emit('close', new CloseEvent('close', { reason: 'Mock disconnect' }));
    }, 10);

    return true;
  }

  /**
   * Mock sending real-time input (audio chunks)
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this._session) return;

    // Simulate processing delay
    setTimeout(() => {
      // Start transcription simulation if audio is being sent
      const hasAudio = chunks.some(chunk => chunk.mimeType.includes('audio'));
      if (hasAudio && !this.isSimulatingTranscription) {
        this.startTranscriptionSimulation();
      }
    }, this.getRandomLatency());
  }

  /**
   * Mock sending tool response
   */
  sendToolResponse(toolResponse: any) {
    if (!this._session) return;
    
    setTimeout(() => {
      this.emit('turncomplete');
    }, this.getRandomLatency());
  }

  /**
   * Mock sending content parts
   */
  send(parts: any, turnComplete: boolean = true) {
    if (!this._session) return;

    setTimeout(() => {
      // Simulate AI response
      this.simulateAIResponse(parts);
      
      if (turnComplete) {
        this.emit('turncomplete');
      }
    }, this.getRandomLatency());
  }

  /**
   * Start simulating real-time transcription
   */
  private startTranscriptionSimulation() {
    if (this.isSimulatingTranscription) return;
    
    this.isSimulatingTranscription = true;
    const phrases = [
      'Hello',
      'Hello, how',
      'Hello, how are',
      'Hello, how are you',
      'Hello, how are you today?'
    ];
    
    let currentIndex = 0;
    
    const simulatePhrase = () => {
      if (currentIndex < phrases.length) {
        const isFinal = currentIndex === phrases.length - 1;
        
        this.emit('input_transcription', {
          text: phrases[currentIndex],
          isFinal
        });
        
        currentIndex++;
        
        if (!isFinal) {
          const timeout = setTimeout(simulatePhrase, 300 + Math.random() * 200);
          this.simulationTimeouts.push(timeout);
        } else {
          this.isSimulatingTranscription = false;
        }
      }
    };
    
    // Start the simulation
    setTimeout(simulatePhrase, 100);
  }

  /**
   * Simulate AI response with transcription and audio
   */
  private simulateAIResponse(inputParts: any) {
    // Simulate output transcription
    const responses = [
      'I\'m doing',
      'I\'m doing great,',
      'I\'m doing great, thank',
      'I\'m doing great, thank you!',
      'I\'m doing great, thank you! How can I help you today?'
    ];
    
    let currentIndex = 0;
    
    const simulateResponse = () => {
      if (currentIndex < responses.length) {
        const isFinal = currentIndex === responses.length - 1;
        
        this.emit('output_transcription', {
          text: responses[currentIndex],
          isFinal
        });
        
        // Simulate audio data for each fragment
        const mockAudioBuffer = new ArrayBuffer(Math.random() * 2048 + 512); // 隨機大小的音頻數據
        const audioData = new Int16Array(mockAudioBuffer);
        
        // 填充隨機音頻數據以模擬真實音頻
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] = Math.floor((Math.random() - 0.5) * 32768 * Math.random() * 0.5); // 模擬語音音量
        }
        
        console.log('🎤 [Mock] 發出音頻數據:', {
          fragmentIndex: currentIndex,
          bufferSize: mockAudioBuffer.byteLength,
          text: responses[currentIndex]
        });
        
        this.emit('audio', mockAudioBuffer);
        
        currentIndex++;
        
        if (!isFinal) {
          const timeout = setTimeout(simulateResponse, 250 + Math.random() * 150);
          this.simulationTimeouts.push(timeout);
        }
      }
    };
    
    setTimeout(simulateResponse, 200);
  }

  /**
   * Simulate tool calls
   */
  simulateToolCall(toolName: string, args: any = {}) {
    setTimeout(() => {
      const mockToolCall = {
        functionCalls: [{
          name: toolName,
          id: `mock_tool_${Date.now()}`,
          args
        }]
      };
      
      this.emit('toolcall', mockToolCall);
    }, this.getRandomLatency());
  }

  /**
   * Simulate errors
   */
  simulateError(message: string = 'Mock error') {
    setTimeout(() => {
      const error = new ErrorEvent('error', { message });
      this.emit('error', error);
    }, 10);
  }

  /**
   * Simulate connection interruption
   */
  simulateInterruption() {
    setTimeout(() => {
      this.emit('interrupted');
    }, 10);
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomLatency(): number {
    if (!this.options.simulateLatency) return 0;
    
    const [min, max] = this.options.latencyRange!;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private shouldSimulateError(): boolean {
    return !!(this.options.simulateErrors && Math.random() < (this.options.errorRate ?? 0.1));
  }

  private clearSimulations() {
    this.simulationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.simulationTimeouts = [];
    this.isSimulatingTranscription = false;
  }

  // Test utilities
  public __testUtils = {
    triggerEvent: (event: keyof LiveClientEventTypes, ...args: any[]) => {
      this.emit(event as any, ...args);
    },
    
    setStatus: (status: "connected" | "disconnected" | "connecting") => {
      this._status = status;
    },
    
    getSimulationState: () => ({
      isSimulatingTranscription: this.isSimulatingTranscription,
      activeTimeouts: this.simulationTimeouts.length
    }),
    
    clearAllSimulations: () => {
      this.clearSimulations();
    }
  };
}

// Export mock factory
export const createMockGenAILiveClient = (options?: MockLiveClientOptions) => {
  return new MockGenAILiveClient(options);
};