import React, { useEffect, useRef, useCallback } from 'react';
import ControlTray from './ControlTray';
import TTSControlTray from './TTSControlTray';
import { TextInput } from './TextInput';
import { SendButton } from './SendButton';
import { ConversationModeSelector } from './ConversationModeSelector';
import { TranscriptionDisplay } from '../conversation-display/TranscriptionDisplay';
import { useChatManager } from '../../hooks/use-chat-manager';
import { useConversation } from '../../hooks/use-conversation';
import { useTranscription } from '../../hooks/use-transcription';
import { useConversationMode } from '../../hooks/use-conversation-mode';
import { useGeminiConversation } from '../../hooks/use-gemini-conversation';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useWebcam } from '../../hooks/use-webcam';
import { useScreenCapture } from '../../hooks/use-screen-capture';
import AudioPulse from '../audio-pulse/AudioPulse';
import './chat-input.scss';

export const ChatInputArea: React.FC = () => {
  // console.log('🎨 [ChatInputArea] 組件渲染');
  const [inputText, setInputText] = React.useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [videoStream, setVideoStream] = React.useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Chat and Live API hooks
  const { activeChatRoom, createNewChatRoom } = useChatManager();
  const { sendTextMessage, connected } = useConversation();
  const { inputTranscription, isRecording } = useTranscription();
  const { 
    connected: liveConnected, 
    volume, 
    client,
    ready,
    connectWithResumption,
    disconnect: originalDisconnect
  } = useLiveAPIContext();
  
  // Import necessary variables for Live API controls
  const webcam = useWebcam();
  const screenCapture = useScreenCapture();
  const [muted, setMuted] = React.useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  
  // Video support detection
  const supportsVideo = true; // Assume video support for now
  
  // Conversation mode management
  const { 
    currentMode, 
    switchMode, 
    isLiveMode, 
    isSTTTTSMode,
    canSwitchMode,
    setCanSwitchMode
  } = useConversationMode();
  
  // Gemini STT+TTS conversation
  const geminiConversation = useGeminiConversation({
    apiKey: process.env.REACT_APP_GEMINI_API_KEY,
    sttLanguage: 'zh-TW',
    ttsLanguage: 'zh-TW',
    enableLogging: process.env.NODE_ENV === 'development'
  });
  
  // 追蹤組件掛載/卸載
  // React.useEffect(() => {
  //   console.log('🔵 [ChatInputArea] 組件掛載');
  //   return () => {
  //     console.log('🔴 [ChatInputArea] 組件卸載');
  //   };
  // }, []);

  // 禁用模式切換當有活躍連接時
  useEffect(() => {
    const hasActiveConnection = liveConnected || geminiConversation.isListening || geminiConversation.isProcessingChat;
    setCanSwitchMode(!hasActiveConnection);
  }, [liveConnected, geminiConversation.isListening, geminiConversation.isProcessingChat, setCanSwitchMode]);

  // Enhanced connect function that uses session resumption
  const enhancedConnect = useCallback(async () => {
    if (liveConnected || client.status === "connecting" || client.status === "reconnecting") {
      return;
    }

    try {
      if (connectButtonRef.current?.disabled) {
        return;
      }
      
      if (connectButtonRef.current) {
        connectButtonRef.current.disabled = true;
      }
      
      let targetChatRoom = activeChatRoom;
      
      if (!targetChatRoom) {
        targetChatRoom = await createNewChatRoom();
      }
      
      await connectWithResumption(targetChatRoom);
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      if (connectButtonRef.current) {
        connectButtonRef.current.disabled = false;
      }
    }
  }, [liveConnected, client.status, activeChatRoom, createNewChatRoom, connectWithResumption]);
  
  // Enhanced disconnect function
  const enhancedDisconnect = useCallback(async () => {
    webcam.stop();
    screenCapture.stop();
    setVideoStream(null);
    setMuted(true);
    await originalDisconnect();
  }, [webcam, screenCapture, originalDisconnect]);
  
  // Handler for video stream changes
  const changeStreams = useCallback((next?: any) => {
    return async () => {
      if (next) {
        const mediaStream = await next.start();
        setVideoStream(mediaStream);
      } else {
        setVideoStream(null);
      }
      
      [webcam, screenCapture].filter((stream) => stream !== next).forEach((stream) => stream.stop());
    };
  }, [webcam, screenCapture]);

  // 當轉錄文字更新時，自動填入到輸入框 (僅 Live API 模式)
  useEffect(() => {
    if (isLiveMode && inputTranscription.status === 'complete' && inputTranscription.currentTranscript) {
      setInputText(inputTranscription.currentTranscript);
    }
  }, [isLiveMode, inputTranscription.status, inputTranscription.currentTranscript]);

  // 監聽 Gemini STT 轉錄結果 (僅 STT+TTS 模式)
  useEffect(() => {
    if (isSTTTTSMode && geminiConversation.currentTranscript) {
      setInputText(geminiConversation.currentTranscript);
    }
  }, [isSTTTTSMode, geminiConversation.currentTranscript]);

  const handleSendMessage = async () => {
    const finalText = inputText.trim() || 
      (isLiveMode ? inputTranscription.currentTranscript.trim() : '') ||
      (isSTTTTSMode ? geminiConversation.currentTranscript.trim() : '');
    
    if (!finalText) return;
    if (!activeChatRoom) return;

    if (isLiveMode) {
      // 使用 Live API
      await sendTextMessage(finalText);
    } else if (isSTTTTSMode) {
      // 使用 Gemini STT+TTS
      await geminiConversation.sendTextMessage(finalText);
    }
    
    // 清除輸入
    setInputText('');
  };

  const handleTranscriptEdit = (newTranscript: string) => {
    setInputText(newTranscript);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Dynamic send button logic based on mode
  const canSend = (() => {
    const hasText = inputText.trim() || 
      (isLiveMode ? inputTranscription.currentTranscript.trim() : '') ||
      (isSTTTTSMode ? geminiConversation.currentTranscript.trim() : '');
    
    if (!hasText || !activeChatRoom) return false;
    
    if (isLiveMode) {
      return connected;
    } else if (isSTTTTSMode) {
      return !geminiConversation.isProcessingChat;
    }
    
    return false;
  })();

  // Dynamic transcription display logic
  const hasTranscriptionContent = (() => {
    if (isLiveMode) {
      return inputTranscription.currentTranscript.trim().length > 0 || isRecording;
    } else if (isSTTTTSMode) {
      return geminiConversation.currentTranscript.trim().length > 0 || geminiConversation.isListening;
    }
    return false;
  })();

  return (
    <div className="chat-input-area">
      {/* Hidden video element for video streaming */}
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} 
        autoPlay 
        playsInline 
        muted 
      />
      
      {/* Show error messages */}
      {isSTTTTSMode && geminiConversation.error && (
        <div className="error-message">
          {geminiConversation.error}
          <button onClick={geminiConversation.clearError}>✕</button>
        </div>
      )}

      {/* STT+TTS Status Indicators (outside main container) */}
      {isSTTTTSMode && (
        <>
          {geminiConversation.isSpeaking && (
            <div className="status-indicator speaking-indicator">
              <span className="material-symbols-outlined">volume_up</span>
              AI 正在朗讀...
            </div>
          )}
          
          {geminiConversation.isProcessingChat && (
            <div className="status-indicator processing-indicator">
              <span className="material-symbols-outlined">autorenew</span>
              AI 正在思考...
            </div>
          )}
          
          {!geminiConversation.isSTTSupported && (
            <div className="status-indicator warning-message">
              您的瀏覽器不支援語音識別功能
            </div>
          )}
        </>
      )}
      
      <div className="input-wrapper">
        {/* Top Toolbar */}
        <div className="top-toolbar">
          {/* Left: Mode Selector */}
          <div className="toolbar-left">
            <ConversationModeSelector
              currentMode={currentMode}
              onModeChange={switchMode}
              disabled={!canSwitchMode}
            />
          </div>
          
          {/* Right: Control Buttons */}
          <div className="toolbar-right">
            {isLiveMode && (
              <>
                {/* Microphone Button */}
                <button
                  className={`toolbar-button mic-button ${!muted ? 'active' : ''}`}
                  onClick={() => setMuted(!muted)}
                  disabled={!connected}
                  title={muted ? "開啟麥克風" : "關閉麥克風"}
                >
                  <span className="material-symbols-outlined">
                    {!muted ? 'mic' : 'mic_off'}
                  </span>
                </button>

                {/* Audio Visualizer */}
                <div className="toolbar-button audio-visualizer no-action">
                  <AudioPulse volume={volume} active={connected} hover={false} />
                </div>

                {/* Screen Share Button */}
                {supportsVideo && (
                  <button
                    className={`toolbar-button screen-button ${screenCapture.isStreaming ? 'active' : ''}`}
                    onClick={screenCapture.isStreaming ? () => changeStreams() : () => changeStreams(screenCapture)}
                    disabled={!connected}
                    title={screenCapture.isStreaming ? "停止分享螢幕" : "分享螢幕"}
                  >
                    <span className="material-symbols-outlined">
                      {screenCapture.isStreaming ? 'cancel_presentation' : 'present_to_all'}
                    </span>
                  </button>
                )}

                {/* Webcam Button */}
                {supportsVideo && (
                  <button
                    className={`toolbar-button video-button ${webcam.isStreaming ? 'active' : ''}`}
                    onClick={webcam.isStreaming ? () => changeStreams() : () => changeStreams(webcam)}
                    disabled={!connected}
                    title={webcam.isStreaming ? "關閉攝像頭" : "開啟攝像頭"}
                  >
                    <span className="material-symbols-outlined">
                      {webcam.isStreaming ? 'videocam_off' : 'videocam'}
                    </span>
                  </button>
                )}

                {/* Connect/Disconnect Button */}
                <button
                  ref={connectButtonRef}
                  className={`toolbar-button connect-button ${connected ? 'active' : ''}`}
                  onClick={connected ? enhancedDisconnect : enhancedConnect}
                  title={connected ? "中斷連接" : "連接"}
                >
                  <span className="material-symbols-outlined">
                    {connected ? 'pause' : 'play_arrow'}
                  </span>
                </button>
              </>
            )}

            {isSTTTTSMode && (
              <>
                {/* STT Microphone Button */}
                <button
                  className={`toolbar-button mic-button ${geminiConversation.isListening ? 'active recording' : ''}`}
                  onClick={geminiConversation.isListening ? geminiConversation.stopListening : geminiConversation.startListening}
                  disabled={!geminiConversation.isSTTSupported || geminiConversation.isProcessingChat}
                  title={geminiConversation.isListening ? "停止語音識別" : "開始語音識別"}
                >
                  <span className="material-symbols-outlined">
                    {geminiConversation.isListening ? 'mic' : 'mic_off'}
                  </span>
                </button>

                {/* Disabled placeholder buttons to maintain layout */}
                <button className="toolbar-button disabled" disabled title="螢幕分享（TTS 模式下不可用）">
                  <span className="material-symbols-outlined">present_to_all</span>
                </button>
                
                <button className="toolbar-button disabled" disabled title="攝像頭（TTS 模式下不可用）">
                  <span className="material-symbols-outlined">videocam</span>
                </button>

                {/* TTS Status Button */}
                <button
                  className={`toolbar-button connect-button ${geminiConversation.isListening ? 'active' : ''}`}
                  onClick={geminiConversation.isListening ? geminiConversation.stopListening : geminiConversation.startListening}
                  disabled={!geminiConversation.isSTTSupported || geminiConversation.isProcessingChat}
                  title={geminiConversation.isListening ? "停止" : "開始"}
                >
                  <span className="material-symbols-outlined">
                    {geminiConversation.isListening ? 'pause' : 'play_arrow'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="input-area">
          <div className="textarea-container">
            <TextInput
              value={inputText}
              onChange={setInputText}
              onKeyPress={handleKeyPress}
              placeholder={(() => {
                if (!activeChatRoom) return "請先選擇或創建聊天室...";
                
                if (isLiveMode) {
                  if (!connected) return "請先點擊連接按鈕連接 AI...";
                  if (inputTranscription.currentTranscript) return "編輯轉錄文字或直接發送...";
                  return "問我任何問題...";
                } else if (isSTTTTSMode) {
                  if (geminiConversation.isProcessingChat) return "AI 正在處理中...";
                  if (geminiConversation.currentTranscript) return "編輯轉錄文字或直接發送...";
                  return "問我任何問題...";
                }
                
                return "問我任何問題...";
              })()}
              disabled={!activeChatRoom || (isSTTTTSMode && geminiConversation.isProcessingChat)}
            />
            
            <SendButton
              onClick={handleSendMessage}
              disabled={!canSend}
            />
          </div>
        </div>
      </div>
    </div>
  );
};