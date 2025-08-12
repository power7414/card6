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
import { sessionDebugLogger } from "../utils/session-debug";
import { sessionResumptionQueue } from "../utils/session-resumption-fix";

export type UseLiveAPIResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  model: string;
  setModel: (model: string) => void;
  connected: boolean;
  ready: boolean;
  connect: () => Promise<void>;
  connectWithResumption: (chatRoomId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  currentChatRoomId: string | null;
  hasValidSession: (chatRoomId: string) => boolean;
  sessionTimeLeft: number | null;
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
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        text: `你很搞笑，盡量語氣活潑。你是一個友善且樂於助人的 AI 助手。請用繁體中文回應。
        
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
  const [ready, setReady] = useState(false);
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
      
      // Start session timer based on model type
      // Audio sessions: 15 minutes, Audio+Video: 2 minutes
      const hasVideo = config?.responseModalities?.includes(Modality.IMAGE);
      const sessionDuration = hasVideo ? 2 * 60 : 15 * 60; // in seconds
      
      // console.log(`🕐 開始 session 計時器: ${sessionDuration} 秒`);
      setSessionTimeLeft(sessionDuration);
      
      // Clear any existing countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setSessionTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };
    
    const onSetupComplete = () => {
      console.log('✅ Setup 完成，可以開始音頻傳輸');
      setReady(true);
    };

    const onClose = () => {
      setConnected(false);
      setReady(false);
      setSessionTimeLeft(null);
      
      // Clear countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
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
      
      // Enhanced debugging
      sessionDebugLogger.log('session_resumption_update', {
        chatRoomId: currentChatRoomId,
        connectingChatRoomId: connectingChatRoomIdRef.current,
        sessionHandle: update.newHandle,
        resumable: update.resumable
      });
      
      console.log('📝 收到 session resumption 更新:', { 
        currentChatRoomId, 
        connectingChatRoomId: connectingChatRoomIdRef.current,
        targetChatRoomId,
        resumable: update.resumable,
        newHandle: update.newHandle ? `${update.newHandle.substring(0, 16)}...` : null
      });
      
      if (targetChatRoomId) {
        // Handle session resumption update with immediate processing first
        (async () => {
          try {
            await sessionResumptionRef.current.handleSessionResumptionUpdate(targetChatRoomId, update);
            
            if (update.resumable && update.newHandle) {
              sessionDebugLogger.log('session_handle_stored', {
                chatRoomId: targetChatRoomId,
                sessionHandle: update.newHandle
              });
              console.log('✅ Session handle 已儲存:', targetChatRoomId);
            } else {
              sessionDebugLogger.log('session_handle_cleared', {
                chatRoomId: targetChatRoomId
              });
              console.log('🧹 Session 不可恢復:', targetChatRoomId);
            }
          } catch (error) {
            sessionDebugLogger.log('session_handle_error', {
              chatRoomId: targetChatRoomId,
              event: 'storage_failed'
            });
            console.error('❌ Session handle 處理失敗:', targetChatRoomId, error);
            
            // If immediate processing fails, queue for retry
            console.log('🔄 Queueing session update for retry...', { targetChatRoomId });
            await sessionResumptionQueue.queueSessionUpdate(targetChatRoomId, update);
          }
        })();
      } else {
        sessionDebugLogger.log('session_resumption_ignored', {
          chatRoomId: null,
          connectingChatRoomId: connectingChatRoomIdRef.current,
          sessionHandle: update.newHandle,
          resumable: update.resumable
        });
        
        // If no target chat room ID is available, queue the update for later processing
        // This handles the race condition where session updates arrive before chat room setup
        if (connectingChatRoomIdRef.current) {
          console.log('🔄 Queueing session update for connecting room...', { 
            connectingRoomId: connectingChatRoomIdRef.current 
          });
          
          (async () => {
            try {
              if (connectingChatRoomIdRef.current) {
                await sessionResumptionQueue.queueSessionUpdate(connectingChatRoomIdRef.current, update);
              }
            } catch (error) {
              console.error('Failed to queue session update:', error);
            }
          })();
        } else {
          console.log('⚠️ 沒有可用的 chatRoomId，忽略 session 更新');
        }
      }
    };
    
    const onGoAway = (data: { reason: string; timeLeft?: string }) => {
      // console.log('⏰ 收到 GoAway 訊息:', data);
      
      // Clear any existing countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      if (data.timeLeft) {
        // Parse timeLeft (assuming it's in seconds)
        const seconds = parseInt(data.timeLeft);
        // console.log('⏱️ 設定 sessionTimeLeft:', seconds);
        setSessionTimeLeft(seconds);
        
        // Start countdown
        countdownIntervalRef.current = setInterval(() => {
          setSessionTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              return null;
            }
            // console.log('⏱️ 倒數計時:', prev - 1);
            return prev - 1;
          });
        }, 1000);
      } else {
        // console.log('⚠️ GoAway 訊息沒有包含 timeLeft');
      }
    };

    client
      .on("error", onError)
      .on("open", onOpen)
      .on("close", onClose)
      .on("setupcomplete", onSetupComplete)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("session_resumption_update", onSessionResumptionUpdate)
      .on("goaway", onGoAway);

    return () => {
      // Clear countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      client
        .off("error", onError)
        .off("open", onOpen)
        .off("close", onClose)
        .off("setupcomplete", onSetupComplete)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("session_resumption_update", onSessionResumptionUpdate)
        .off("goaway", onGoAway)
        .disconnect();
    };
  }, [client, currentChatRoomId, config]);

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

    // Prevent duplicate connections by checking client status
    if (client.status === "connecting" || client.status === "reconnecting") {
      console.log('⚠️ [connectWithResumption] 連接進行中，跳過重複連接');
      return;
    }

    console.log('🔄 連接至聊天室:', chatRoomId);
    
    sessionDebugLogger.log('connect_start', {
      chatRoomId,
      connectingChatRoomId: null
    });

    // Set both the state and ref for session management
    setCurrentChatRoomId(chatRoomId);
    connectingChatRoomIdRef.current = chatRoomId;

    // Wait longer to ensure chat room is properly created and synchronized
    // This prevents race conditions with session handle storage
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get session handle for this chat room
    const sessionHandle = sessionResumptionRef.current.getSessionHandle(chatRoomId);
    
    sessionDebugLogger.log('session_handle_retrieved', {
      chatRoomId,
      sessionHandle: sessionHandle,
      resumable: !!sessionHandle
    });
    
    if (sessionHandle) {
      console.log('🔄 找到 session handle，嘗試恢復連接');
    } else {
      console.log('🆕 開始新的 session');
    }
    
    // Get session stats for debugging
    const sessionStats = sessionResumptionRef.current.getSessionStats();
    console.log('📊 Session 統計:', sessionStats);
    
    client.disconnect();
    
    try {
      // Connection attempt with proper error handling for setup timeout
      const success = await client.connect(model, config, sessionHandle);
      
      if (success) {
        sessionDebugLogger.log('connect_success', {
          chatRoomId,
          sessionHandle: sessionHandle,
          hadSessionHandle: !!sessionHandle
        });
        
        console.log(`✅ 連接成功: ${chatRoomId}`);
      } else {
        throw new Error('Connection returned false');
      }
    } catch (error) {
      sessionDebugLogger.log('connect_error', {
        chatRoomId,
        sessionHandle: sessionHandle,
        hadSessionHandle: !!sessionHandle,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error('❌ 連接失敗:', error);
      
      // If session resumption fails, clear the invalid handle and try new session
      if (sessionHandle) {
        sessionDebugLogger.log('session_handle_expired', {
          chatRoomId,
          sessionHandle: sessionHandle
        });
        await sessionResumptionRef.current.clearSessionHandle(chatRoomId);
        
        // Only retry if it was a setup timeout or session-related error
        if (error instanceof Error && (
          error.message.includes('Setup timeout') || 
          error.message.includes('session') ||
          error.message.includes('resumption')
        )) {
          console.log('🔄 使用新 session 重試...');
          try {
            const retrySuccess = await client.connect(model, config);
            
            if (retrySuccess) {
              sessionDebugLogger.log('connect_success', {
                chatRoomId,
                sessionHandle: null,
                hadSessionHandle: false,
                retryConnection: true
              });
              
              console.log('✅ 新 session 連接成功');
            } else {
              throw new Error('Retry connection failed');
            }
          } catch (retryError) {
            console.error('❌ 重試連接也失敗:', retryError);
            throw retryError;
          }
        } else {
          // Re-throw the original error if it's not session-related
          throw error;
        }
      } else {
        // Re-throw the original error if there was no session handle
        throw error;
      }
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
    setReady(false);
    setSessionTimeLeft(null);
    
    // Clear countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    model,
    setModel,
    connected,
    ready,
    connect,
    connectWithResumption,
    disconnect,
    volume,
    currentChatRoomId,
    hasValidSession: (chatRoomId: string) => sessionResumptionRef.current.hasValidSession(chatRoomId),
    sessionTimeLeft,
  };
}
