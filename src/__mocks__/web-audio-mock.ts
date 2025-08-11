/**
 * Web Audio API Mock Service
 * 
 * Comprehensive mock for Web Audio API components including AudioContext,
 * MediaRecorder, AudioWorklet, and related interfaces.
 */

// MediaRecorder error event interface
export interface MediaRecorderErrorEvent extends Event {
  readonly error: DOMException;
}

export interface MockAudioContextOptions {
  sampleRate?: number;
  simulateLatency?: boolean;
  simulateErrors?: boolean;
}

export class MockAudioContext {
  public sampleRate: number;
  public currentTime: number = 0;
  public state: AudioContextState = 'running';
  public destination: MockAudioDestinationNode;
  
  private options: MockAudioContextOptions;
  private nodes: MockAudioNode[] = [];
  private timeUpdateInterval: NodeJS.Timeout | null = null;

  constructor(options: MockAudioContextOptions = {}) {
    this.options = {
      sampleRate: 44100,
      simulateLatency: false,
      simulateErrors: false,
      ...options
    };
    
    this.sampleRate = this.options.sampleRate!;
    this.destination = new MockAudioDestinationNode(this);
    
    // Simulate time progression
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime += 0.1;
    }, 100);
  }

  createAnalyser(): MockAnalyserNode {
    const analyser = new MockAnalyserNode(this);
    this.nodes.push(analyser);
    return analyser;
  }

  createGain(): MockGainNode {
    const gain = new MockGainNode(this);
    this.nodes.push(gain);
    return gain;
  }

  createOscillator(): MockOscillatorNode {
    const oscillator = new MockOscillatorNode(this);
    this.nodes.push(oscillator);
    return oscillator;
  }

  createScriptProcessor(
    bufferSize?: number,
    numberOfInputChannels?: number,
    numberOfOutputChannels?: number
  ): MockScriptProcessorNode {
    const processor = new MockScriptProcessorNode(
      this,
      bufferSize || 4096,
      numberOfInputChannels || 2,
      numberOfOutputChannels || 2
    );
    this.nodes.push(processor);
    return processor;
  }

  createMediaStreamSource(stream: MediaStream): MockMediaStreamAudioSourceNode {
    const source = new MockMediaStreamAudioSourceNode(this, stream);
    this.nodes.push(source);
    return source;
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    return Promise.resolve();
  }

  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  // Test utilities
  public __testUtils = {
    getNodeCount: () => this.nodes.length,
    clearNodes: () => { this.nodes = []; },
    setCurrentTime: (time: number) => { this.currentTime = time; },
    setState: (state: AudioContextState) => { this.state = state; }
  };
}

export class MockAudioNode {
  protected context: MockAudioContext;
  protected connections: MockAudioNode[] = [];

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(destination: MockAudioNode): void {
    this.connections.push(destination);
  }

  disconnect(destination?: MockAudioNode): void {
    if (destination) {
      const index = this.connections.indexOf(destination);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    } else {
      this.connections = [];
    }
  }
}

export class MockAnalyserNode extends MockAudioNode {
  public frequencyBinCount: number = 512;
  public fftSize: number = 2048;
  public minDecibels: number = -100;
  public maxDecibels: number = -30;
  public smoothingTimeConstant: number = 0.8;

  getByteFrequencyData(array: Uint8Array): void {
    // Fill with mock frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.random() * 255;
    }
  }

  getFloatFrequencyData(array: Float32Array): void {
    // Fill with mock frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = (Math.random() - 0.5) * 200;
    }
  }

  getByteTimeDomainData(array: Uint8Array): void {
    // Fill with mock time domain data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.sin(i * 0.1) * 127;
    }
  }

  getFloatTimeDomainData(array: Float32Array): void {
    // Fill with mock time domain data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.sin(i * 0.1);
    }
  }
}

export class MockGainNode extends MockAudioNode {
  public gain: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.gain = new MockAudioParam(1);
  }
}

export class MockOscillatorNode extends MockAudioNode {
  public frequency: MockAudioParam;
  public type: OscillatorType = 'sine';
  private started = false;
  private stopped = false;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(440);
  }

  start(when?: number): void {
    this.started = true;
  }

  stop(when?: number): void {
    this.stopped = true;
  }
}

export class MockScriptProcessorNode extends MockAudioNode {
  public onaudioprocess: ((event: AudioProcessingEvent) => void) | null = null;
  public bufferSize: number;
  
  constructor(
    context: MockAudioContext,
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number
  ) {
    super(context);
    this.bufferSize = bufferSize;
  }

  // Simulate audio processing
  __simulateAudioProcess(): void {
    if (this.onaudioprocess) {
      const mockEvent = {
        inputBuffer: new MockAudioBuffer(2, this.bufferSize, this.context.sampleRate),
        outputBuffer: new MockAudioBuffer(2, this.bufferSize, this.context.sampleRate),
        playbackTime: this.context.currentTime
      } as AudioProcessingEvent;

      this.onaudioprocess(mockEvent);
    }
  }
}

export class MockMediaStreamAudioSourceNode extends MockAudioNode {
  public mediaStream: MediaStream;

  constructor(context: MockAudioContext, stream: MediaStream) {
    super(context);
    this.mediaStream = stream;
  }
}

export class MockAudioDestinationNode extends MockAudioNode {
  public maxChannelCount: number = 2;
}

export class MockAudioParam {
  public value: number;

  constructor(initialValue: number) {
    this.value = initialValue;
  }

  setValueAtTime(value: number, startTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): MockAudioParam {
    this.value = value;
    return this;
  }
}

export class MockAudioBuffer {
  public numberOfChannels: number;
  public length: number;
  public sampleRate: number;
  public duration: number;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
  }

  getChannelData(channel: number): Float32Array {
    const data = new Float32Array(this.length);
    // Fill with mock audio data (sine wave)
    for (let i = 0; i < this.length; i++) {
      data[i] = Math.sin(2 * Math.PI * 440 * i / this.sampleRate) * 0.5;
    }
    return data;
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void {
    const sourceData = this.getChannelData(channelNumber);
    const start = startInChannel || 0;
    destination.set(sourceData.slice(start));
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void {
    // Mock implementation
  }
}

export class MockMediaRecorder {
  public state: RecordingState = 'inactive';
  public mimeType: string;
  public stream: MediaStream;
  
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onstop: ((event: Event) => void) | null = null;
  public onstart: ((event: Event) => void) | null = null;
  public onerror: ((event: MediaRecorderErrorEvent) => void) | null = null;

  private recordingInterval: NodeJS.Timeout | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType || 'audio/webm';
  }

  start(timeslice?: number): void {
    this.state = 'recording';
    
    if (this.onstart) {
      this.onstart(new Event('start'));
    }

    // Simulate data availability
    if (timeslice && this.ondataavailable) {
      this.recordingInterval = setInterval(() => {
        if (this.ondataavailable) {
          const mockBlob = new Blob(['mock audio data'], { type: this.mimeType });
          const event = new BlobEvent('dataavailable', { data: mockBlob });
          this.ondataavailable(event);
        }
      }, timeslice);
    }
  }

  stop(): void {
    this.state = 'inactive';
    
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Final data event
    if (this.ondataavailable) {
      const mockBlob = new Blob(['final mock audio data'], { type: this.mimeType });
      const event = new BlobEvent('dataavailable', { data: mockBlob });
      this.ondataavailable(event);
    }

    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }

  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }

  static isTypeSupported(type: string): boolean {
    return ['audio/webm', 'audio/mp4', 'audio/wav'].includes(type);
  }
}

// Export factory functions
export const createMockAudioContext = (options?: MockAudioContextOptions) => {
  return new MockAudioContext(options);
};

export const createMockMediaRecorder = (stream: MediaStream, options?: MediaRecorderOptions) => {
  return new MockMediaRecorder(stream, options);
};