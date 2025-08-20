/**
 * ControlTray component adapted from live-api-web-console
 * Provides media controls for audio, video, and screen sharing
 */

import cn from "classnames";
import { memo, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useChatManager } from "../../hooks/use-chat-manager";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import "./control-tray.scss";

export type ControlTrayProps = {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo?: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
  showModeSelector?: boolean;
  modeSelector?: ReactNode;
};

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: string;
  offIcon: string;
  start: () => Promise<any>;
  stop: () => any;
};

/**
 * Button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
  ({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
    isStreaming ? (
      <button className="action-button" onClick={stop} title="Stop">
        <span className="material-symbols-outlined">{onIcon}</span>
      </button>
    ) : (
      <button className="action-button" onClick={start} title="Start">
        <span className="material-symbols-outlined">{offIcon}</span>
      </button>
    )
);

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo = true,
  showModeSelector = false,
  modeSelector,
}: ControlTrayProps) {
  // console.log('🎨 [ControlTray] 組件渲染');
  const webcam = useWebcam();
  const screenCapture = useScreenCapture();
  const videoStreams = useMemo(() => [webcam, screenCapture], [webcam, screenCapture]);
  const [activeVideoStream, setActiveVideoStream] =
    useState<MediaStream | null>(null);
  // inVolume state 已移除（不再需要圓形背景效果）
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  
  // 追蹤組件掛載/卸載
  // useEffect(() => {
  //   console.log('🔵 [ControlTray] 組件掛載');
  //   return () => {
  //     console.log('🔴 [ControlTray] 組件卸載');
  //   };
  // }, []);

  const { client, connected, ready, connectWithResumption, disconnect: originalDisconnect, volume } =
    useLiveAPIContext();
  const { activeChatRoom, createNewChatRoom } = useChatManager();
    
  // Enhanced connect function that uses session resumption
  const enhancedConnect = useCallback(async () => {
    // Check both connected and ready states to prevent duplicate connections
    if (connected || client.status === "connecting" || client.status === "reconnecting") {
      console.log('⚠️ [ControlTray] 已經連接或連接中，跳過連接動作', {
        connected,
        ready,
        clientStatus: client.status
      });
      return;
    }

    try {
      // 防止重複連接：檢查是否正在連接中
      if (connectButtonRef.current?.disabled) {
        console.log('⚠️ [ControlTray] 連接按鈕被禁用，跳過重複連接');
        return;
      }
      
      // 暫時禁用按鈕防止重複點擊
      if (connectButtonRef.current) {
        connectButtonRef.current.disabled = true;
      }
      
      let targetChatRoom = activeChatRoom;
      
      // If no active chat room, create a new one
      if (!targetChatRoom) {
        console.log('🏗️ [ControlTray] 沒有活動聊天室，創建新的聊天室...');
        targetChatRoom = await createNewChatRoom();
      }
      
      console.log('🔌 [ControlTray] 使用 session resumption 連接到聊天室:', targetChatRoom);
      await connectWithResumption(targetChatRoom);
      console.log('✅ [ControlTray] connectWithResumption 完成');
    } catch (error) {
      console.error('❌ [ControlTray] 連接失敗:', error);
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('Setup timeout')) {
        console.log('⚠️ [ControlTray] Live API 設置超時，請檢查網路連接或重試');
      }
    } finally {
      // 重新啟用按鈕
      if (connectButtonRef.current) {
        connectButtonRef.current.disabled = false;
      }
    }
  }, [connected, ready, client.status, activeChatRoom, createNewChatRoom, connectWithResumption]);
  
  // 監控 useCallback 依賴性變化
  // useEffect(() => {
  //   console.log('🔄 [ControlTray] enhancedConnect dependencies 的變化:', {
  //     connected,
  //     activeChatRoom,
  //     timestamp: Date.now()
  //   });
  // }, [connected, activeChatRoom, createNewChatRoom, connectWithResumption]);

  // Enhanced disconnect function that cleans up media devices
  const enhancedDisconnect = useCallback(async () => {
    console.log('🔌 [ControlTray] enhancedDisconnect 被呼叫');
    
    // Stop all video streams
    videoStreams.forEach((stream) => stream.stop());
    setActiveVideoStream(null);
    onVideoStreamChange(null);
    
    // Stop audio recording and set muted
    audioRecorder.stop();
    setMuted(true);
    
    // Perform original disconnect
    // console.log('🔌 [ControlTray] 呼叫 originalDisconnect');
    await originalDisconnect();
    // console.log('✅ [ControlTray] disconnect 完成');
  }, [videoStreams, audioRecorder, onVideoStreamChange, originalDisconnect]);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  // CSS 變數設定已移除（不再需要圓形背景效果）

  // Audio recording and streaming
  useEffect(() => {
    const onData = (base64: string) => {
      // 只有在 ready 狀態下才發送音頻數據
      if (client && client.sendRealtimeInput && ready) {
        client.sendRealtimeInput([
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          },
        ]);
      }
    };
    
    // 只有在 ready 狀態下才開始音頻錄製
    if (ready && !muted && audioRecorder) {
      console.log('🎤 開始音頻錄製和傳輸');
      audioRecorder.on("data", onData).start();
    } else {
      audioRecorder.stop();
    }
    
    return () => {
      audioRecorder.off("data", onData);
    };
  }, [ready, client, muted, audioRecorder]);

  // Video streaming
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId: number = -1;

    function sendVideoFrame() {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas || !client || !client.sendRealtimeInput) {
        return;
      }

      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      
      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 1.0);
        const data = base64.slice(base64.indexOf(",") + 1, Infinity);
        client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
      }
      
      if (ready) {
        timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
      }
    }
    
    if (ready && activeVideoStream !== null) {
      requestAnimationFrame(sendVideoFrame);
    }
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [ready, activeVideoStream, client, videoRef]);

  // Handler for swapping from one video-stream to the next
  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    if (next) {
      const mediaStream = await next.start();
      setActiveVideoStream(mediaStream);
      onVideoStreamChange(mediaStream);
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }

    videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
  };

  return (
    <section className="control-tray">
      <canvas style={{ display: "none" }} ref={renderCanvasRef} />
      
      {/* Mode Selector - placed before action buttons */}
      {showModeSelector && modeSelector && (
        <div className="mode-selector-container">
          {modeSelector}
        </div>
      )}
      
      <nav className={cn("actions-nav", { disabled: !connected })}>
        <button
          className={cn("action-button mic-button", { active: !muted })}
          onClick={() => setMuted(!muted)}
          title={muted ? "Unmute microphone" : "Mute microphone"}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>

        <div className="action-button no-action outlined">
          <AudioPulse volume={volume} active={connected} hover={false} />
        </div>

        {supportsVideo && (
          <>
            <MediaStreamButton
              isStreaming={screenCapture.isStreaming}
              start={changeStreams(screenCapture)}
              stop={changeStreams()}
              onIcon="cancel_presentation"
              offIcon="present_to_all"
            />
            <MediaStreamButton
              isStreaming={webcam.isStreaming}
              start={changeStreams(webcam)}
              stop={changeStreams()}
              onIcon="videocam_off"
              offIcon="videocam"
            />
          </>
        )}
        {children}
      </nav>

      <div className={cn("connection-container", { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn("action-button connect-toggle", { connected })}
            onClick={connected ? enhancedDisconnect : enhancedConnect}
            title={connected ? "Disconnect" : "Connect"}
          >
            <span className="material-symbols-outlined filled">
              {connected ? "pause" : "play_arrow"}
            </span>
          </button>
        </div>
        <span className="text-indicator">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </section>
  );
}

export default memo(ControlTray);