/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Content,
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from "@google/genai";

import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";
import { LiveClientOptions, StreamingLog } from "../types";
import { base64ToArrayBuffer } from "./utils";

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (error: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  // Emitted when input transcription is received (user speech)
  input_transcription: (transcription: { text: string; isFinal?: boolean }) => void;
  // Emitted when output transcription is received (AI speech)
  output_transcription: (transcription: { text: string; isFinal?: boolean }) => void;
  // Emitted when server sends GoAway message indicating session will end
  goaway: (data: { reason: string; timeLeft?: string }) => void;
  // Emitted when session timeout is approaching
  session_timeout_warning: (timeRemaining: number) => void;
  // Emitted when attempting to reconnect
  reconnecting: () => void;
  // Emitted when reconnection succeeds
  reconnected: () => void;
  // Emitted when session resumption update is received
  session_resumption_update: (update: { resumable: boolean; newHandle: string | null }) => void;
}

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class GenAILiveClient extends EventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;

  private _status: "connected" | "disconnected" | "connecting" | "reconnecting" = "disconnected";
  private _setupComplete: boolean = false;
  
  public get status() {
    return this._status;
  }
  
  public get isReady() {
    return this._status === "connected" && this._setupComplete;
  }

  private _session: Session | null = null;
  public get session() {
    return this._session;
  }

  private _model: string | null = null;
  public get model() {
    return this._model;
  }

  protected config: LiveConnectConfig | null = null;

  // Session management
  private sessionStartTime: number | null = null;
  private sessionTimeoutId: NodeJS.Timeout | null = null;
  private sessionWarningTimeoutId: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000; // Start with 1 second delay
  private autoReconnect = true;

  // Context window management
  private contextTokenCount = 0;
  private maxContextTokens = 32000; // Default for most models
  private nativeAudioModels = ["gemini-2.5-flash-preview-native-audio-dialog"];
  private conversationHistory: Part[] = [];

  public getConfig() {
    return { ...this.config };
  }

  constructor(options: LiveClientOptions) {
    super();
    this.client = new GoogleGenAI(options);
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  protected log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  private getSessionTimeout(): number {
    // Check if config includes video (image) processing
    const hasVideo = this.config?.responseModalities?.some((modality: any) => 
      modality.toString().toLowerCase().includes('video') || 
      modality.toString().toLowerCase().includes('image')
    ) || false;
    // Audio sessions: 15 minutes, Audio+Video: 2 minutes
    return hasVideo ? 2 * 60 * 1000 : 15 * 60 * 1000;
  }

  private setupSessionTimeout() {
    this.clearSessionTimeouts();
    
    const timeout = this.getSessionTimeout();
    const warningTime = timeout - 30 * 1000; // Warn 30 seconds before timeout
    
    this.sessionStartTime = Date.now();
    
    // Set warning timer
    this.sessionWarningTimeoutId = setTimeout(() => {
      const remaining = 30; // 30 seconds remaining
      this.emit("session_timeout_warning", remaining);
      this.log("session.timeout_warning", `Session will timeout in ${remaining} seconds`);
    }, warningTime);
    
    // Set timeout timer
    this.sessionTimeoutId = setTimeout(() => {
      this.log("session.timeout", "Session timeout reached");
      this.handleSessionTimeout();
    }, timeout);
  }

  private clearSessionTimeouts() {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
    if (this.sessionWarningTimeoutId) {
      clearTimeout(this.sessionWarningTimeoutId);
      this.sessionWarningTimeoutId = null;
    }
  }

  private handleSessionTimeout() {
    this.log("session.timeout", "Session timed out, attempting reconnection");
    this.disconnect();
    if (this.autoReconnect) {
      this.attemptReconnect();
    }
  }

  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("session.reconnect", "Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    this._status = "reconnecting";
    this.emit("reconnecting");
    this.log("session.reconnect", `Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    try {
      if (this._model && this.config) {
        const success = await this.connect(this._model, this.config);
        if (success) {
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000; // Reset delay
          this.emit("reconnected");
          this.log("session.reconnect", "Reconnection successful");
        } else {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000); // Exponential backoff, max 10s
          this.attemptReconnect();
        }
      }
    } catch (error) {
      this.log("session.reconnect", `Reconnection failed: ${error}`);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
      this.attemptReconnect();
    }
  }

  async connect(model: string, config: LiveConnectConfig, sessionHandle?: string | null): Promise<boolean> {
    if (sessionHandle) {
      console.log('🔄 嘗試恢復 session:', sessionHandle.substring(0, 16) + '...');
    } else {
      console.log('🆕 開始新 session');
    }
    
    if (this._status === "connected" || this._status === "connecting") {
      // console.log('⚠️ 已經連接或正在連接，跳過');
      return false;
    }

    this._status = "connecting";
    this._setupComplete = false;
    
    // Connection details already logged above
    
    // Add session resumption config - ALWAYS include sessionResumption to enable the feature
    const enhancedConfig = {
      ...config,
      contextWindowCompression: { slidingWindow: {} },
      // Always include sessionResumption to enable the feature
      sessionResumption: sessionHandle ? { handle: sessionHandle } : {}
    };
    
    console.log('📋 Session resumption 配置:', enhancedConfig.sessionResumption);
    
    this.config = enhancedConfig;
    this._model = model;
    
    // Set context window size based on model
    this.maxContextTokens = this.nativeAudioModels.includes(model) ? 128000 : 32000;
    this.contextTokenCount = 0;
    this.conversationHistory = [];

    const callbacks: LiveCallbacks = {
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
      onclose: this.onclose,
    };

    try {
      // Attempting to connect with Live API - should be available in @google/genai 1.15.0+
      this._session = await this.client.live.connect({
        model,
        config: enhancedConfig,
        callbacks,
      });
      
      console.log('✅ Live API connection established successfully');
      this.reconnectAttempts = 0; // Reset on successful connection
      
      // Wait for setup completion before marking as connected
      // This prevents premature audio data sending
      return await new Promise<boolean>((resolve, reject) => {
        let setupCompleted = false;
        
        const timeout = setTimeout(() => {
          if (!setupCompleted) {
            console.error('❌ Setup timeout after 10 seconds - connection failed');
            this._status = "disconnected";
            this._setupComplete = false;
            this.off("setupcomplete", onSetupComplete);
            reject(new Error('Setup timeout: Live API did not complete setup within 10 seconds'));
          }
        }, 10000); // Increased to 10 second timeout for better reliability
        
        // Wait for setupcomplete event
        const onSetupComplete = () => {
          if (!setupCompleted) {
            setupCompleted = true;
            clearTimeout(timeout);
            this._status = "connected";
            this._setupComplete = true;
            this.setupSessionTimeout();
            this.off("setupcomplete", onSetupComplete);
            console.log('✅ Setup 完成，連接建立成功');
            resolve(true);
          }
        };
        
        this.once("setupcomplete", onSetupComplete);
      });
    } catch (e) {
      console.error("Error connecting to GenAI Live:", e);
      this._status = "disconnected";
      this._setupComplete = false;
      return false;
    }
  }

  public disconnect() {
    this.clearSessionTimeouts();
    
    if (!this.session) {
      return false;
    }
    this.session?.close();
    this._session = null;
    this._status = "disconnected";
    this._setupComplete = false;
    this.sessionStartTime = null;

    this.log("client.close", `Disconnected`);
    return true;
  }

  protected onopen() {
    this.log("client.open", "Connected");
    this.emit("open");
  }

  protected onerror(e: ErrorEvent) {
    this.log("server.error", e.message);
    this.emit("error", e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      `server.close`,
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ``}`
    );
    this.emit("close", e);
  }

  protected async onmessage(message: LiveServerMessage) {
    // console.log('📨 收到伺服器訊息:', Object.keys(message));
    
    if (message.setupComplete) {
      this.log("server.send", "setupComplete");
      console.log('✅ Setup 完成，連接建立成功');
      this.emit("setupcomplete");
      return;
    }
    
    // Handle Session Resumption Update
    if ('sessionResumptionUpdate' in message && message.sessionResumptionUpdate) {
      console.log('🔍 [Live API] 收到 sessionResumptionUpdate 原始訊息:', message.sessionResumptionUpdate);
      const update = message.sessionResumptionUpdate as any;
      const resumptionData = {
        resumable: update.resumable || false,
        newHandle: update.newHandle || null
      };
      this.log("server.session_resumption_update", `resumable: ${resumptionData.resumable}, newHandle: ${resumptionData.newHandle}`);
      console.log('📝 [Live API] 處理後的 session resumption 資料:', resumptionData);
      this.emit("session_resumption_update", resumptionData);
      return;
    }
    
    // Handle GoAway message (server indicating session will end)
    if ('goAway' in message && message.goAway) {
      const goAwayData = message.goAway as any;
      const reason = goAwayData.reason || "Server initiated session termination";
      const timeLeft = goAwayData.timeLeft;
      
      this.log("server.goaway", `reason: ${reason}, timeLeft: ${timeLeft}`);
      this.emit("goaway", { reason, timeLeft });
      this.clearSessionTimeouts();
      
      // Auto-reconnect if enabled
      if (this.autoReconnect && timeLeft) {
        // Wait for the remaining time before attempting reconnect
        const waitTime = Math.max(1000, parseInt(timeLeft) * 1000 - 500); // Convert to ms and leave 500ms buffer
        setTimeout(() => this.attemptReconnect(), waitTime);
      } else if (this.autoReconnect) {
        setTimeout(() => this.attemptReconnect(), 1000);
      }
      return;
    }
    
    if (message.toolCall) {
      this.log("server.toolCall", message);
      this.emit("toolcall", message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log("server.toolCallCancellation", message);
      this.emit("toolcallcancellation", message.toolCallCancellation);
      return;
    }

    // this json also might be `contentUpdate { interrupted: true }`
    // or contentUpdate { end_of_turn: true }
    if (message.serverContent) {
      const { serverContent } = message;
      if ("interrupted" in serverContent) {
        this.log("server.content", "interrupted");
        this.emit("interrupted");
        return;
      }
      if ("turnComplete" in serverContent) {
        this.log("server.content", "turnComplete");
        this.emit("turncomplete");
      }

      if ("modelTurn" in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts || [];

        // when its audio that is returned for modelTurn
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/pcm")
        );
        const base64s = audioParts.map((p) => p.inlineData?.data);

        // strip the audio parts out of the modelTurn
        const otherParts = difference(parts, audioParts);
        // console.log("otherParts", otherParts);

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit("audio", data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        
        // Track AI response tokens
        const tokenCount = this.estimateTokenCount(parts);
        this.contextTokenCount += tokenCount;
        this.conversationHistory.push(...parts);
        
        this.emit("content", content);
        this.log(`server.content`, `Received content with ${tokenCount} tokens, context usage: ${this.getContextWindowUsage()}%`);
      }

      // Handle input transcription (user speech)
      if ("inputTranscription" in serverContent) {
        const transcription = {
          text: serverContent.inputTranscription?.text || "",
          isFinal: (serverContent.inputTranscription as any)?.isFinal || false
        };
        this.emit("input_transcription", transcription);
        this.log("server.input_transcription", `Input transcription: ${transcription.text} (final: ${transcription.isFinal})`);
      }

      // Handle output transcription (AI speech)
      if ("outputTranscription" in serverContent) {
        const transcription = {
          text: serverContent.outputTranscription?.text || "",
          isFinal: (serverContent.outputTranscription as any)?.isFinal || false
        };
        this.emit("output_transcription", transcription);
        this.log("server.output_transcription", `Output transcription: ${transcription.text} (final: ${transcription.isFinal})`);
      }
    } else {
      console.log("received unmatched message", message);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    // Check if session is ready to receive data
    if (!this.isReady || !this.session) {
      console.warn('⚠️ Session not ready, skipping realtime input');
      return;
    }
    
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      try {
        this.session.sendRealtimeInput({ media: ch });
        if (ch.mimeType.includes("audio")) {
          hasAudio = true;
        }
        if (ch.mimeType.includes("image")) {
          hasVideo = true;
        }
        if (hasAudio && hasVideo) {
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('WebSocket') || errorMessage.includes('CLOSED')) {
          console.warn('⚠️ WebSocket closed, stopping realtime input');
          return;
        } else {
          console.error('❌ Error sending realtime input:', error);
          throw error;
        }
      }
    }
    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
        ? "audio"
        : hasVideo
        ? "video"
        : "unknown";
    this.log(`client.realtimeInput`, message);
  }

  /**
   *  send a response to a function call and provide the id of the functions you are responding to
   */
  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log(`client.toolResponse`, toolResponse);
    }
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    const partsArray = Array.isArray(parts) ? parts : [parts];
    
    // Track token usage
    const tokenCount = this.estimateTokenCount(partsArray);
    this.contextTokenCount += tokenCount;
    this.conversationHistory.push(...partsArray);
    
    // Check if context needs compression
    if (this.shouldCompressContext()) {
      this.compressContext();
    }
    
    this.session?.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, {
      turns: partsArray,
      turnComplete
    });
  }

  /**
   * Enable or disable auto-reconnection
   */
  setAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }

  /**
   * Get remaining session time in milliseconds
   */
  getSessionTimeRemaining(): number | null {
    if (!this.sessionStartTime) return null;
    
    const elapsed = Date.now() - this.sessionStartTime;
    const timeout = this.getSessionTimeout();
    const remaining = timeout - elapsed;
    
    return Math.max(0, remaining);
  }

  /**
   * Reset reconnection attempts counter
   */
  resetReconnectionAttempts() {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  /**
   * Manual reconnection attempt
   */
  async reconnect(): Promise<boolean> {
    if (this._status === "connected") {
      return true;
    }
    
    this.resetReconnectionAttempts();
    await this.attemptReconnect();
    // TypeScript doesn't recognize that attemptReconnect can change the status
    return (this._status as string) === "connected";
  }

  /**
   * Estimate token count for content (rough approximation)
   */
  private estimateTokenCount(parts: Part | Part[]): number {
    const partsArray = Array.isArray(parts) ? parts : [parts];
    let tokenCount = 0;
    
    for (const part of partsArray) {
      if (part.text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        tokenCount += Math.ceil(part.text.length / 4);
      } else if (part.inlineData) {
        // Audio/image data tokens are more complex to estimate
        // For audio PCM: roughly 1 token per 100ms at 16kHz
        // For images: varies by size, roughly 85-340 tokens per image
        if (part.inlineData.mimeType?.startsWith("audio/")) {
          tokenCount += 50; // Conservative estimate for audio chunk
        } else if (part.inlineData.mimeType?.startsWith("image/")) {
          tokenCount += 200; // Conservative estimate for image
        }
      }
    }
    
    return tokenCount;
  }

  /**
   * Check if context window needs compression
   */
  private shouldCompressContext(): boolean {
    return this.contextTokenCount > (this.maxContextTokens * 0.8); // Compress at 80% capacity
  }

  /**
   * Compress conversation history by removing older messages
   */
  private compressContext() {
    if (this.conversationHistory.length <= 2) {
      return; // Keep at least system message and last user message
    }

    // Remove oldest messages until we're under 60% of max tokens
    const targetTokens = this.maxContextTokens * 0.6;
    let removedTokens = 0;
    let removedCount = 0;

    // Keep the first message (usually system) and remove from index 1
    for (let i = 1; i < this.conversationHistory.length - 1; i++) {
      const tokens = this.estimateTokenCount(this.conversationHistory[i]);
      removedTokens += tokens;
      removedCount++;
      
      if (this.contextTokenCount - removedTokens <= targetTokens) {
        break;
      }
    }

    if (removedCount > 0) {
      this.conversationHistory.splice(1, removedCount);
      this.contextTokenCount -= removedTokens;
      this.log("context.compress", `Removed ${removedCount} messages, ${removedTokens} tokens`);
    }
  }

  /**
   * Get current context window usage
   */
  getContextWindowUsage(): { current: number; max: number; percentage: number } {
    return {
      current: this.contextTokenCount,
      max: this.maxContextTokens,
      percentage: (this.contextTokenCount / this.maxContextTokens) * 100
    };
  }
}
