/**
 * TTS Mode Control Tray
 * 簡化版的控制台，只包含麥克風和音頻視覺化功能
 */

import cn from "classnames";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import "./control-tray.scss";

export type TTSControlTrayProps = {
  isListening: boolean;
  onToggleListening: () => void;
  disabled?: boolean;
  showModeSelector?: boolean;
  modeSelector?: React.ReactNode;
};

function TTSControlTray({
  isListening,
  onToggleListening,
  disabled = false,
  showModeSelector = false,
  modeSelector
}: TTSControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [volume, setVolume] = useState(0);
  
  // 使用 Live API 的音頻處理邏輯（但不連接到 Live API）
  const { client } = useLiveAPIContext();
  
  // 音頻錄製和音量檢測
  useEffect(() => {
    const onData = (base64: string) => {
      // 在 TTS 模式下不發送數據到 Live API，只用於音量檢測
      // 這裡可以添加音量檢測邏輯
    };
    
    const onVolumeChange = (newVolume: number) => {
      setVolume(newVolume);
    };
    
    if (isListening && !disabled && audioRecorder) {
      audioRecorder
        .on("data", onData)
        .on("volume", onVolumeChange)
        .start();
    } else {
      audioRecorder.stop();
      setVolume(0);
    }
    
    return () => {
      audioRecorder.off("data", onData);
      audioRecorder.off("volume", onVolumeChange);
    };
  }, [isListening, disabled, audioRecorder]);

  return (
    <section className="control-tray tts-mode">
      {/* Mode Selector - placed before action buttons */}
      {showModeSelector && modeSelector && (
        <div className="mode-selector-container">
          {modeSelector}
        </div>
      )}
      
      <nav className={cn("actions-nav", { disabled })}>
        {/* 麥克風按鈕 */}
        <button
          className={cn("action-button mic-button", { 
            active: isListening && !disabled,
            disabled 
          })}
          onClick={onToggleListening}
          disabled={disabled}
          title={isListening ? "停止語音識別" : "開始語音識別"}
        >
          {isListening && !disabled ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>

        {/* 音頻視覺化 */}
        <div className="action-button no-action outlined">
          <AudioPulse 
            volume={volume} 
            active={isListening && !disabled} 
            hover={false} 
          />
        </div>

        {/* 佔位元素，保持佈局一致性 */}
        <div className="action-button placeholder disabled">
          <span className="material-symbols-outlined">present_to_all</span>
        </div>
        
        <div className="action-button placeholder disabled">
          <span className="material-symbols-outlined">videocam</span>
        </div>
      </nav>

      {/* 狀態指示器 */}
      <div className={cn("connection-container", { connected: isListening && !disabled })}>
        <div className="connection-button-container">
          <button
            className={cn("action-button connect-toggle", { 
              connected: isListening && !disabled,
              disabled 
            })}
            onClick={onToggleListening}
            disabled={disabled}
            title={isListening ? "停止語音識別" : "開始語音識別"}
          >
            <span className="material-symbols-outlined filled">
              {isListening && !disabled ? "pause" : "play_arrow"}
            </span>
          </button>
        </div>
        <span className="text-indicator">
          {disabled 
            ? "Disabled"
            : isListening 
              ? "Listening" 
              : "Ready"
          }
        </span>
      </div>
    </section>
  );
}

export default memo(TTSControlTray);