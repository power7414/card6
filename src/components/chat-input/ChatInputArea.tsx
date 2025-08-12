import React, { useEffect, useRef } from 'react';
import ControlTray from './ControlTray';
import { TextInput } from './TextInput';
import { SendButton } from './SendButton';
import { TranscriptionDisplay } from '../conversation-display/TranscriptionDisplay';
import { useChatManager } from '../../hooks/use-chat-manager';
import { useConversation } from '../../hooks/use-conversation';
import { useTranscription } from '../../hooks/use-transcription';
import './chat-input.scss';

export const ChatInputArea: React.FC = () => {
  // console.log('🎨 [ChatInputArea] 組件渲染');
  const [inputText, setInputText] = React.useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [videoStream, setVideoStream] = React.useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeChatRoom } = useChatManager();
  const { sendTextMessage, connected } = useConversation();
  const { inputTranscription, isRecording } = useTranscription();
  
  // 追蹤組件掛載/卸載
  // React.useEffect(() => {
  //   console.log('🔵 [ChatInputArea] 組件掛載');
  //   return () => {
  //     console.log('🔴 [ChatInputArea] 組件卸載');
  //   };
  // }, []);

  // 當轉錄文字更新時，自動填入到輸入框
  useEffect(() => {
    if (inputTranscription.status === 'complete' && inputTranscription.currentTranscript) {
      setInputText(inputTranscription.currentTranscript);
    }
  }, [inputTranscription.status, inputTranscription.currentTranscript]);

  const handleSendMessage = async () => {
    const finalText = inputText.trim() || inputTranscription.currentTranscript.trim();
    if (!finalText) return;
    if (!activeChatRoom) return;

    // 使用真正的 API 調用
    await sendTextMessage(finalText);
    
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

  const canSend = (inputText.trim() || inputTranscription.currentTranscript.trim()) && activeChatRoom && connected;
  const hasTranscriptionContent = inputTranscription.currentTranscript.trim().length > 0 || isRecording;

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
      
      {/* New ControlTray component from live-api-web-console */}
      <ControlTray 
        key="control-tray"
        videoRef={videoRef}
        supportsVideo={true}
        onVideoStreamChange={setVideoStream}
      />
      
      {/* 顯示轉錄結果 */}
      {hasTranscriptionContent && (
        <div className="transcription-section">
          <TranscriptionDisplay
            type="input"
            allowEdit={true}
            onTranscriptEdit={handleTranscriptEdit}
          />
        </div>
      )}
      
      <div className="input-row">
        <TextInput
          value={inputText}
          onChange={setInputText}
          onKeyPress={handleKeyPress}
          placeholder={
            !connected
              ? "請先點擊連接按鈕連接 AI..." 
              : inputTranscription.currentTranscript 
                ? "編輯轉錄文字或直接發送..." 
                : "在這裡輸入訊息或點擊麥克風開始語音輸入..."
          }
          disabled={!activeChatRoom}
        />
        
        <SendButton
          onClick={handleSendMessage}
          disabled={!canSend}
        />
      </div>
    </div>
  );
};