/**
 * 基於 Google Live API 的類型定義
 */

import {
  GoogleGenAIOptions,
  LiveClientToolResponse,
  LiveServerMessage,
  Part,
} from "@google/genai";

/**
 * Live API 客戶端選項
 */
export type LiveClientOptions = GoogleGenAIOptions & { apiKey: string };

/** 日誌類型 */
export type StreamingLog = {
  date: Date;
  type: string;
  count?: number;
  message:
    | string
    | ClientContentLog
    | Omit<LiveServerMessage, "text" | "data">
    | LiveClientToolResponse;
};

export type ClientContentLog = {
  turns: Part[];
  turnComplete: boolean;
};

/** 語音狀態 */
export type VoiceState = {
  isRecording: boolean;
  isMuted: boolean;
  volume: number;
};

/** 輸入狀態 */
export type ChatInputState = {
  text: string;
  isTyping: boolean;
};