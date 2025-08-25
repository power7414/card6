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
import { useSettings } from "../contexts/SettingsContext";

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
  updateLiveConfiguration: () => Promise<void>; // 新增：即時更新配置函數
};

export function useLiveAPI(options: LiveClientOptions): UseLiveAPIResults {
  const client = useMemo(() => {
    const newClient = new GenAILiveClient(options);
    // Disable auto-reconnect to prevent connection loops
    newClient.setAutoReconnect(false);
    return newClient;
  }, [options]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  
  // Get dynamic system prompt, voice settings and TTS style prompt from settings
  const { systemPrompt, settings, ttsStylePrompt } = useSettings();
  
  // Session resumption integration
  const sessionResumption = useSessionResumption({
    enableLogging: true  // 啟用 logging 以便除錯
  });
  
  // Create stable reference to session resumption functions
  const sessionResumptionRef = useRef(sessionResumption);
  sessionResumptionRef.current = sessionResumption;
  
  // Track current chat room for session management
  const [currentChatRoomId, setCurrentChatRoomId] = useState<string | null>(null);
  const connectingChatRoomIdRef = useRef<string | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Speech config 整合前端設定
  const [model, setModel] = useState<string>(settings.models.liveApi);
  
  // 當設定中的模型改變時更新
  useEffect(() => {
    setModel(settings.models.liveApi);
  }, [settings.models.liveApi]);
  
  // 根據前端設定動態生成語音配置
  const getSpeechConfig = useCallback(() => {
    return {
      languageCode: "cmn-CN", // Live API 主要使用語言代碼控制
      // 注意：Live API 語音控制主要透過 systemInstruction 實現
      // 不同於 TTS API 的 voiceConfig
    };
  }, []);

  const [config, setConfig] = useState<LiveConnectConfig>(() => ({
    responseModalities: [Modality.AUDIO],
    outputAudioTranscription: {},
    inputAudioTranscription: {},
    speechConfig: getSpeechConfig(),
    systemInstruction: {
      parts: [{
        text: systemPrompt // 初始值，會被 useEffect 更新
      }]
    },
    // 啟用 Session Resumption 功能
    sessionResumption: {}
  }));
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(0);

  // Generate enhanced system instruction with voice style
  const getEnhancedSystemInstruction = useCallback(() => {
    // 將語音風格整合到系統提示中（Live API 主要透過文字指導控制語音）
    const voiceGuidance = ttsStylePrompt 
      ? `重要：在語音回應時，請${ttsStylePrompt}。` 
      : '';
    
    const enhancedPrompt = voiceGuidance 
      ? `${voiceGuidance}\n\n${systemPrompt}`
      : systemPrompt;
      
    // Enhanced system instruction generated silently
    
    return enhancedPrompt;
  }, [systemPrompt, ttsStylePrompt]);

  // Update config when system prompt or settings change
  useEffect(() => {
    // Config updated silently
    setConfig(prevConfig => ({
      ...prevConfig,
      speechConfig: getSpeechConfig(),
      systemInstruction: {
        parts: [{
          text: getEnhancedSystemInstruction()
        }]
      }
    }));
  }, [systemPrompt, getSpeechConfig, getEnhancedSystemInstruction]);

  // Function to update live configuration during active session
  const updateLiveConfiguration = useCallback(async () => {
    if (!connected || !client) {
      console.log('🔄 [LiveAPI] Not connected, skipping live config update');
      return;
    }

    try {
      // Live configuration updated silently
      const updatedConfig = {
        ...config,
        systemInstruction: {
          parts: [{
            text: getEnhancedSystemInstruction()
          }]
        }
      };
      
      // Note: 不需要在這裡更新本地配置，已在 useEffect 中處理
      
    } catch (error) {
      console.error('❌ [LiveAPI] Failed to update live configuration:', error);
    }
  }, [connected, client, getEnhancedSystemInstruction, settings.voice, settings.tone]);

  // Trigger configuration update when settings change and Live API is connected
  useEffect(() => {
    if (connected && client) {
      // Settings changed, updating configuration silently
      updateLiveConfiguration();
    }
  }, [settings.voice, settings.tone, connected, updateLiveConfiguration, client]);

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
      
      // Start session timer - 15 minutes for audio sessions
      const sessionDuration = 15 * 60; // 15 minutes in seconds
      
      console.log(`🕐 開始 session 計時器: ${sessionDuration} 秒`);
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
      console.error('❌ LiveAPI 錯誤:', error.message || error);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    // 簡化的取得當前聊天室 ID 邏輯
    const getCurrentChatRoomId = () => {
      return currentChatRoomId || connectingChatRoomIdRef.current;
    };
    
    const onSessionResumptionUpdate = (update: { resumable: boolean; newHandle: string | null }) => {
      const chatRoomId = getCurrentChatRoomId();
      
      if (!chatRoomId) {
        console.log('⚠️ 沒有指定的聊天室，跳過 session 更新');
        return;
      }
      
      // 檢查是否正在恢復連接
      const wasResuming = sessionResumptionRef.current.getSessionHandle(chatRoomId) !== null;
      
      console.log(`📝 Session 更新: ${chatRoomId}`, {
        resumable: update.resumable,
        hasHandle: !!update.newHandle,
        wasResuming: wasResuming
      });
      
      // 如果是恢復連接且收到空的更新，忽略它
      // 這是 Google Live API 的已知行為，成功恢復後會發送空的 sessionResumptionUpdate
      if (wasResuming && !update.resumable && !update.newHandle) {
        console.log('⚠️ 忽略恢復連接後的空 sessionResumptionUpdate:', chatRoomId);
        return;
      }
      
      // 使用 session resumption hook 處理更新
      sessionResumptionRef.current.handleSessionResumptionUpdate(chatRoomId, update)
        .catch(error => {
          console.error('❌ Session 處理失敗:', chatRoomId, error.message);
        });
    };
    
    const onGoAway = (data: { reason: string; timeLeft?: string }) => {
      console.log('⏰ 收到 GoAway 訊息:', data);
      
      // Clear any existing countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      if (data.timeLeft) {
        // Parse timeLeft (assuming it's in seconds)
        const seconds = parseInt(data.timeLeft);
        console.log('⏱️ 設定 sessionTimeLeft:', seconds);
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
            console.log('⏱️ 倒數計時:', prev - 1);
            return prev - 1;
          });
        }, 1000);
      } else {
        console.log('⚠️ GoAway 訊息沒有包含 timeLeft');
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

    // Set both the state and ref for session management
    setCurrentChatRoomId(chatRoomId);
    connectingChatRoomIdRef.current = chatRoomId;

    // Wait longer to ensure chat room is properly created and synchronized
    // This prevents race conditions with session handle storage
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get session handle for this chat room
    const sessionHandle = sessionResumptionRef.current.getSessionHandle(chatRoomId);
    
    // 簡化的連接狀態日誌
    const status = sessionHandle ? '恢復連接' : '新連接';
    console.log(`🔄 ${status}: ${chatRoomId}`);
    
    client.disconnect();
    
    try {
      // Connection attempt with proper error handling for setup timeout
      const success = await client.connect(model, config, sessionHandle);
      
      if (success) {
        console.log(`✅ 連接成功: ${chatRoomId}`);
      } else {
        throw new Error('Connection returned false');
      }
    } catch (error) {
      console.error('❌ 連接失敗:', error instanceof Error ? error.message : error);
      
      // If session resumption fails, clear the invalid handle and try new session
      if (sessionHandle) {
        console.log('🧹 清除過期的 session handle:', chatRoomId);
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
              console.log('✅ 新 session 連接成功');
            } else {
              throw new Error('Retry connection failed');
            }
          } catch (retryError) {
            console.error('❌ 重試連接失敗:', retryError instanceof Error ? retryError.message : retryError);
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
    updateLiveConfiguration, // 新增：即時更新配置函數
  };
}
