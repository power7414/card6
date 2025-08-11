import { useCallback, useRef, useState, useMemo } from 'react';
import { TranscriptionState, TranscriptionSegment } from '../types/transcription';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';

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

export function useTranscription(): UseTranscriptionResult {
  const { client, connected } = useLiveAPIContext();
  
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