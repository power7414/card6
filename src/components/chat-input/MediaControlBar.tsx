import React, { useState, useEffect, useRef } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhone, FiActivity } from 'react-icons/fi';
import { useTranscription } from '../../hooks/use-transcription';
import { useConversation } from '../../hooks/use-conversation';
import AudioPulse from '../audio-pulse/AudioPulse';

export const MediaControlBar: React.FC = () => {
  const { 
    isRecording, 
    inputTranscription,
    startInputTranscription, 
    stopInputTranscription,
    clearTranscriptions 
  } = useTranscription();
  const { sendRealtimeInput, connected } = useConversation();
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(false);
  const [isScreenSharing, setIsScreenSharing] = React.useState(false);
  
  // Audio visualization state for microphone button
  const [micVolume, setMicVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio context and start monitoring microphone input
  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const monitorAudio = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedVolume = Math.min(average / 128, 1); // Normalize to 0-1
        
        setMicVolume(normalizedVolume);
        animationFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();
    } catch (error) {
      console.error('Failed to access microphone:', error);
    }
  };

  // Stop audio monitoring and cleanup
  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setMicVolume(0);
  };

  // Effect to handle recording state changes
  useEffect(() => {
    if (isRecording) {
      startAudioMonitoring();
    } else {
      stopAudioMonitoring();
    }
    
    return () => {
      stopAudioMonitoring();
    };
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopInputTranscription();
    } else {
      if (connected) {
        startInputTranscription();
      } else {
        console.warn('Cannot start recording: Live API not connected');
      }
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    // TODO: 整合實際的視頻功能
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    // TODO: 整合實際的螢幕分享功能
  };

  const makeCall = () => {
    // TODO: 整合撥打電話功能
    console.log('Make call');
  };

  const clearAllTranscriptions = () => {
    clearTranscriptions();
  };

  return (
    <div className="media-control-bar">
      <div className="media-controls">
        <button
          className={`control-button mic-button ${isRecording ? 'active recording' : ''} ${!connected ? 'disabled' : ''}`}
          onClick={toggleRecording}
          disabled={!connected}
          aria-label={isRecording ? '停止錄音' : '開始錄音'}
        >
          {isRecording ? (
            <div className="mic-with-pulse">
              <AudioPulse active={true} volume={micVolume} hover={false} />
            </div>
          ) : (
            <FiMic />
          )}
          {!isRecording && !connected && <FiMicOff />}
        </button>

        <button
          className={`control-button ${isVideoEnabled ? 'active' : ''}`}
          onClick={toggleVideo}
          aria-label={isVideoEnabled ? '關閉攝影機' : '開啟攝影機'}
        >
          {isVideoEnabled ? <FiVideo /> : <FiVideoOff />}
        </button>

        <button
          className={`control-button ${isScreenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          aria-label={isScreenSharing ? '停止分享螢幕' : '分享螢幕'}
        >
          <FiMonitor />
        </button>

        <button
          className="control-button"
          onClick={makeCall}
          aria-label="撥打電話"
        >
          <FiPhone />
        </button>

        {(inputTranscription.currentTranscript || isRecording) && (
          <button
            className="control-button clear-transcription"
            onClick={clearAllTranscriptions}
            aria-label="清除轉錄"
            title="清除所有轉錄記錄"
          >
            <FiActivity />
          </button>
        )}
      </div>


      <div className="media-status">
        {isRecording && (
          <div className="status-indicator recording">
            <div className="recording-dot" />
            <span>錄音中</span>
          </div>
        )}
        {inputTranscription.isTranscribing && (
          <div className="status-indicator transcribing">
            <FiActivity className="transcribing-icon" />
            <span>轉錄中...</span>
          </div>
        )}
        {inputTranscription.status === 'complete' && inputTranscription.currentTranscript && (
          <div className="status-indicator transcription-ready">
            <span>轉錄完成</span>
          </div>
        )}
        {inputTranscription.error && (
          <div className="status-indicator error">
            <span>轉錄錯誤: {inputTranscription.error}</span>
          </div>
        )}
        {!connected && (
          <div className="status-indicator warning">
            <span>未連接到 Live API</span>
          </div>
        )}
        {isVideoEnabled && (
          <div className="status-indicator">
            <span>攝影機已開啟</span>
          </div>
        )}
        {isScreenSharing && (
          <div className="status-indicator">
            <span>正在分享螢幕</span>
          </div>
        )}
      </div>
    </div>
  );
};