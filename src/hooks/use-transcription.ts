import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { TranscriptionState, TranscriptionSegment } from '../types/transcription';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { useChatManager } from './use-chat-manager';
import { createUserMessage } from '../utils/message-factory';

export interface UseTranscriptionOptions {
  /**
   * 是否啟用 Live API 事件整合
   * 設為 true 時會自動註冊轉錄事件監聽器
   */
  enableLiveAPIIntegration?: boolean;
}

export interface UseTranscriptionResult {
  // State
  inputTranscription: TranscriptionState;
  outputTranscription: TranscriptionState;
  isRecording: boolean;
  
  // Actions
  startInputTranscription: () => void;
  stopInputTranscription: () => void;
  clearTranscriptions: () => void;
  
  // Event handlers for internal use
  handleInputTranscription: (segment: TranscriptionSegment) => void;
  handleOutputTranscription: (segment: TranscriptionSegment) => void;
  
  // Live API specific handlers (for accumulated content)
  setInputTranscriptionDirect: (text: string, isFinal: boolean) => void;
  setOutputTranscriptionDirect: (text: string, isFinal: boolean) => void;
}

export function useTranscription(options: UseTranscriptionOptions = {}): UseTranscriptionResult {
  const { enableLiveAPIIntegration = false } = options;
  const { client, connected } = useLiveAPIContext();
  const { addMessage, updateMessage } = usePersistentChatStore();
  const { activeChatRoom } = useChatManager();
  
  // Input transcription state (user speech)
  const [inputTranscription, setInputTranscription] = useState<TranscriptionState>({
    currentTranscript: '',
    isTranscribing: false,
    status: 'idle'
  });
  
  // Output transcription state (AI speech)
  const [outputTranscription, setOutputTranscription] = useState<TranscriptionState>({
    currentTranscript: '',
    isTranscribing: false,
    status: 'idle'
  });
  
  const [isRecording, setIsRecording] = useState(false);
  const inputSegmentsRef = useRef<TranscriptionSegment[]>([]);
  const outputSegmentsRef = useRef<TranscriptionSegment[]>([]);
  
  // Live API integration - 追蹤當前用戶語音訊息的 ID
  const currentUserMessageRef = useRef<string | null>(null);
  
  // Memoized transcript builders for performance
  const buildTranscript = useCallback((segments: TranscriptionSegment[]) => {
    return segments.map(seg => seg.text).join(' ').trim();
  }, []);

  // Handle input transcription updates (user speech)
  const handleInputTranscription = useCallback((segment: TranscriptionSegment) => {
    inputSegmentsRef.current.push(segment);
    
    // Use memoized builder
    const fullTranscript = buildTranscript(inputSegmentsRef.current);
    
    setInputTranscription(prev => ({
      ...prev,
      currentTranscript: fullTranscript,
      isTranscribing: !segment.isFinal,
      status: segment.isFinal ? 'complete' : 'processing'
    }));
  }, [buildTranscript]);
  
  // Handle output transcription updates (AI speech)
  const handleOutputTranscription = useCallback((segment: TranscriptionSegment) => {
    outputSegmentsRef.current.push(segment);
    
    // Use memoized builder
    const fullTranscript = buildTranscript(outputSegmentsRef.current);
    
    setOutputTranscription(prev => ({
      ...prev,
      currentTranscript: fullTranscript,
      isTranscribing: !segment.isFinal,
      status: segment.isFinal ? 'complete' : 'processing'
    }));
  }, [buildTranscript]);
  
  // Start input transcription (begin recording user speech)
  const startInputTranscription = useCallback(() => {
    if (!connected) {
      console.warn('Cannot start transcription: Live API not connected');
      return;
    }
    
    setIsRecording(true);
    setInputTranscription(prev => ({
      ...prev,
      isTranscribing: true,
      status: 'recording',
      error: undefined
    }));
    
    // Clear previous input segments
    inputSegmentsRef.current = [];
  }, [connected]);
  
  // Stop input transcription
  const stopInputTranscription = useCallback(() => {
    setIsRecording(false);
    setInputTranscription(prev => ({
      ...prev,
      isTranscribing: false,
      status: prev.currentTranscript ? 'complete' : 'idle'
    }));
  }, []);
  
  // Clear all transcriptions
  const clearTranscriptions = useCallback(() => {
    inputSegmentsRef.current = [];
    outputSegmentsRef.current = [];
    
    setInputTranscription({
      currentTranscript: '',
      isTranscribing: false,
      status: 'idle'
    });
    
    setOutputTranscription({
      currentTranscript: '',
      isTranscribing: false,
      status: 'idle'
    });
    
    setIsRecording(false);
  }, []);
  
  // Live API specific handlers for accumulated content (不是增量片段)
  const setInputTranscriptionDirect = useCallback((text: string, isFinal: boolean) => {
    // 清除現有片段，因為 Live API 發送的是累積內容
    inputSegmentsRef.current = [];
    
    setInputTranscription({
      currentTranscript: text,
      isTranscribing: !isFinal,
      status: isFinal ? 'complete' : 'processing'
    });
  }, []);
  
  const setOutputTranscriptionDirect = useCallback((text: string, isFinal: boolean) => {
    // 清除現有片段，因為 Live API 發送的是累積內容
    outputSegmentsRef.current = [];
    
    setOutputTranscription({
      currentTranscript: text,
      isTranscribing: !isFinal,
      status: isFinal ? 'complete' : 'processing'
    });
  }, []);

  // Live API 事件整合 (僅在啟用時執行)
  useEffect(() => {
    if (!enableLiveAPIIntegration || !client) {
      return;
    }

    // 追蹤累積的用戶語音內容
    let accumulatedUserTranscript = '';

    // 處理用戶語音輸入轉錄事件
    const onInputTranscription = (data: { text: string; isFinal?: boolean }) => {
      const transcriptionFragment = data.text?.trim();
      if (transcriptionFragment) {
        // 1. 累積新的轉錄片段（與 AI 輸出邏輯一致）
        if (!currentUserMessageRef.current) {
          // 開始新訊息，從頭開始累積
          accumulatedUserTranscript = transcriptionFragment;
        } else {
          // 累積新片段到現有內容
          accumulatedUserTranscript += transcriptionFragment;
        }
        
        const fullTranscript = accumulatedUserTranscript;
        
        // 2. 更新轉錄狀態（使用累積的完整內容）
        setInputTranscriptionDirect(fullTranscript, data.isFinal ?? false);
        
        // 3. 只有在有活動聊天室時才顯示在對話框中
        if (!activeChatRoom) {
          return;
        }
        
        // 4. 將累積的轉錄顯示在對話框中
        if (!currentUserMessageRef.current) {
          // 創建新的用戶語音訊息，使用累積的內容
          const userMessage = createUserMessage(fullTranscript, { isTyping: !data.isFinal });
          currentUserMessageRef.current = userMessage.id;
          addMessage(activeChatRoom, userMessage);
        } else {
          // 更新現有的用戶語音訊息，使用累積的完整內容
          updateMessage?.(activeChatRoom, currentUserMessageRef.current, (msg) => {
            return { 
              ...msg, 
              content: fullTranscript,  // 使用累積的完整轉錄
              isTyping: !data.isFinal 
            };
          });
        }
        
        // 當轉錄完成時，重置當前訊息 ID 和累積器
        if (data.isFinal) {
          currentUserMessageRef.current = null;
          accumulatedUserTranscript = '';
        }
      }
    };

    // 處理 turnComplete 事件 - 重置用戶訊息追蹤和累積器
    const onTurnComplete = () => {
      currentUserMessageRef.current = null;
      accumulatedUserTranscript = '';
    };

    // 註冊事件監聽器
    client.on('input_transcription', onInputTranscription);
    client.on('turncomplete', onTurnComplete);

    return () => {
      client.off('input_transcription', onInputTranscription);
      client.off('turncomplete', onTurnComplete);
    };
  }, [enableLiveAPIIntegration, client, setInputTranscriptionDirect, activeChatRoom, addMessage, updateMessage]);
  
  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    inputTranscription,
    outputTranscription,
    isRecording,
    startInputTranscription,
    stopInputTranscription,
    clearTranscriptions,
    handleInputTranscription,
    handleOutputTranscription,
    setInputTranscriptionDirect,
    setOutputTranscriptionDirect
  }), [
    inputTranscription,
    outputTranscription,
    isRecording,
    startInputTranscription,
    stopInputTranscription,
    clearTranscriptions,
    handleInputTranscription,
    handleOutputTranscription,
    setInputTranscriptionDirect,
    setOutputTranscriptionDirect
  ]);
}

// 為了向後相容，提供一個專門的整合 hook
export function useTranscriptionIntegration() {
  return useTranscription({ enableLiveAPIIntegration: true });
}