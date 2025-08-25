import React, { useEffect, useRef, useCallback } from 'react';
import { TextInput } from './TextInput';
import { SendButton } from './SendButton';
import { ConversationModeSelector } from './ConversationModeSelector';
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
  
  // Gemini LLM+TTS conversation (移除 STT 功能)
  const geminiConversation = useGeminiConversation({
    geminiApiKey: process.env.REACT_APP_GEMINI_API_KEY,
    ttsLanguage: 'zh-TW',
    enableLogging: process.env.NODE_ENV === 'development',
    enabled: true // 始終啟用 LLM+TTS 模式
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
    const hasActiveConnection = liveConnected || geminiConversation.connected || geminiConversation.isProcessingChat;
    setCanSwitchMode(!hasActiveConnection);
  }, [liveConnected, geminiConversation.connected, geminiConversation.isProcessingChat, setCanSwitchMode]);

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

  // STT 功能已移除，不再監聽轉錄結果

  const handleSendMessage = async () => {
    const finalText = inputText.trim() || 
      (isLiveMode ? inputTranscription.currentTranscript.trim() : '');
    
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


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Dynamic send button logic based on mode
  const canSend = (() => {
    const hasText = inputText.trim() || 
      (isLiveMode ? inputTranscription.currentTranscript.trim() : '');
    
    if (!hasText || !activeChatRoom) return false;
    
    if (isLiveMode) {
      return connected;
    } else if (isSTTTTSMode) {
      return geminiConversation.connected && geminiConversation.ready && !geminiConversation.isProcessingChat;
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

      {/* LLM+TTS Status Indicators (outside main container) */}
      {isSTTTTSMode && (
        <>
          {/* Connection status indicators */}
          {!geminiConversation.connected && (
            <div className="status-indicator connection-indicator">
              <span className="material-symbols-outlined">link_off</span>
              請點擊連接按鈕來啟動 LLM+TTS 服務
            </div>
          )}
          
          {geminiConversation.connected && !geminiConversation.ready && (
            <div className="status-indicator connecting-indicator">
              <span className="material-symbols-outlined">hourglass_empty</span>
              正在初始化 LLM+TTS 服務...
            </div>
          )}

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
                {/* LLM+TTS Connection Button */}
                <button
                  className={`toolbar-button connect-button ${geminiConversation.connected ? 'active' : ''}`}
                  onClick={geminiConversation.connected ? geminiConversation.disconnect : geminiConversation.connect}
                  disabled={geminiConversation.isProcessingChat}
                  title={geminiConversation.connected ? "中斷 LLM+TTS 連接" : "連接 LLM+TTS 服務"}
                >
                  <span className="material-symbols-outlined">
                    {geminiConversation.connected ? 'pause' : 'play_arrow'}
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
                  if (!geminiConversation.connected) return "請先點擊連接按鈕來啟動 LLM+TTS 服務...";
                  if (!geminiConversation.ready) return "服務初始化中...";
                  if (geminiConversation.isProcessingChat) return "AI 正在處理中...";
                  return "輸入訊息並發送，AI 會自動朗讀回覆...";
                }
                
                return "問我任何問題...";
              })()}
              disabled={!activeChatRoom || (isSTTTTSMode && (!geminiConversation.connected || !geminiConversation.ready || geminiConversation.isProcessingChat))}
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