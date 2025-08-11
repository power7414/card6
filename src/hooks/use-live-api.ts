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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenAILiveClient } from "../lib/genai-live-client";
import { LiveClientOptions } from "../types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";
import { LiveConnectConfig, Modality } from "@google/genai";
import { useSessionResumption } from "./use-session-resumption";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  connect: () => Promise<void>;
  connectWithResumption: (chatRoomId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  currentChatRoomId: string | null;
  hasValidSession: (chatRoomId: string) => boolean;
};

export function useLiveAPI(options: LiveClientOptions): UseLiveAPIResults {
  const client = useMemo(() => {
    const newClient = new GenAILiveClient(options);
    // Disable auto-reconnect to prevent connection loops
    newClient.setAutoReconnect(false);
    return newClient;
  }, [options]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  
  // Session resumption integration
  const sessionResumption = useSessionResumption({
    enableLogging: true,
    autoCleanupExpired: true
  });
  
  // Create stable reference to session resumption functions
  const sessionResumptionRef = useRef(sessionResumption);
  sessionResumptionRef.current = sessionResumption;
  
  // Track current chat room for session management
  const [currentChatRoomId, setCurrentChatRoomId] = useState<string | null>(null);
  const connectingChatRoomIdRef = useRef<string | null>(null);

  const [model, setModel] = useState<string>("models/gemini-2.0-flash-exp");
  const [config, setConfig] = useState<LiveConnectConfig>({
    responseModalities: [Modality.AUDIO],
    outputAudioTranscription: {},
    inputAudioTranscription: {},
    speechConfig: {
      languageCode: "cmn-CN"
    },
    systemInstruction: {
      parts: [{
        text: `你是一個友善且樂於助人的 AI 助手。請用繁體中文回應。
        
請遵循以下指示：
- 保持對話友善和專業
- 提供清晰、準確的資訊
- 如果不確定某個問題的答案，請誠實說明
- 保持回應簡潔且相關
- 使用台灣慣用的繁體中文用詞`
      }]
    }
  });
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(0);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      setConnected(true);
    };

    const onClose = () => {
      setConnected(false);
    };

    const onError = (error: ErrorEvent) => {
      console.error("error", error);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    const onSessionResumptionUpdate = (update: { resumable: boolean; newHandle: string | null }) => {
      // Use connecting room ID if current room ID is not set yet (handles timing issues)
      const targetChatRoomId = currentChatRoomId || connectingChatRoomIdRef.current;
      
      console.log('📝 收到 session resumption 更新:', { 
        currentChatRoomId, 
        connectingChatRoomId: connectingChatRoomIdRef.current,
        targetChatRoomId,
        update 
      });
      
      if (targetChatRoomId) {
        sessionResumptionRef.current.handleSessionResumptionUpdate(targetChatRoomId, update)
          .then(() => {
            console.log('✅ Session handle 已儲存:', targetChatRoomId);
          })
          .catch(error => {
            console.error('❌ Session handle 儲存失敗:', error);
          });
      } else {
        console.log('⚠️ 沒有可用的 chatRoomId，忽略 session 更新');
      }
    };

    client
      .on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("session_resumption_update", onSessionResumptionUpdate);

    return () => {
      client
        .off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("session_resumption_update", onSessionResumptionUpdate)
        .disconnect();
    };
  }, [client, currentChatRoomId]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error("config has not been set");
    }
    client.disconnect();
    await client.connect(model, config);
  }, [client, config, model]);

  const connectWithResumption = useCallback(async (chatRoomId: string) => {
    if (!config) {
      throw new Error("config has not been set");
    }

    // Set both the state and ref for session management
    setCurrentChatRoomId(chatRoomId);
    connectingChatRoomIdRef.current = chatRoomId;

    // Get session handle for this chat room
    const sessionHandle = sessionResumptionRef.current.getSessionHandle(chatRoomId);
    console.log('🔍 connectWithResumption 調試:', {
      chatRoomId,
      sessionHandle,
      hasValidSession: sessionResumptionRef.current.hasValidSession(chatRoomId)
    });
    
    client.disconnect();
    
    try {
      // Attempt connection with session resumption if handle exists
      await client.connect(model, config, sessionHandle);
      
      console.log(`Connected to chat room ${chatRoomId}${sessionHandle ? ' with session resumption' : ' with new session'}`);
    } catch (error) {
      console.error('Failed to connect with session resumption, trying new session:', error);
      
      // If session resumption fails, clear the invalid handle and try new session
      if (sessionHandle) {
        await sessionResumptionRef.current.clearSessionHandle(chatRoomId);
      }
      
      // Retry with new session
      await client.connect(model, config);
    } finally {
      // Clear the connecting ref once connection is complete
      setTimeout(() => {
        connectingChatRoomIdRef.current = null;
      }, 2000); // Give enough time for any session updates to process
    }
  }, [client, config, model, setCurrentChatRoomId]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    connect,
    connectWithResumption,
    disconnect,
    volume,
    currentChatRoomId,
    hasValidSession: (chatRoomId: string) => sessionResumptionRef.current.hasValidSession(chatRoomId),
  };
}
