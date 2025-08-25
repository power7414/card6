import { useState, useCallback, useEffect } from 'react';
import './settings-modal.scss';

// 語調選項
export const TONE_OPTIONS = [
  { value: 'lively', label: '活潑', systemPrompt: '你很搞笑，盡量語氣活潑。' },
  { value: 'calm', label: '沉穩', systemPrompt: '請保持語氣沉穩冷靜。' },
  { value: 'passionate', label: '熱情', systemPrompt: '請用熱情洋溢的語氣回應。' },
  { value: 'relaxed', label: '輕鬆', systemPrompt: '請用輕鬆隨性的語氣回應。' },
  { value: 'impatient', label: '不耐煩', systemPrompt: '請用略帶不耐煩的語氣回應。' }
] as const;

// 音色選項 (支援 Live API 和 TTS API 的共同音色)
export const VOICE_OPTIONS = [
  { value: 'Zephyr', label: 'Zephyr', description: '清新明亮' },
  { value: 'Puck', label: 'Puck', description: '活潑俏皮' },
  { value: 'Leda', label: 'Leda', description: '溫和穩重' },
  { value: 'Kore', label: 'Kore', description: '專業標準' },
  { value: 'Charon', label: 'Charon', description: '低沉厚重' },
  { value: 'Fenrir', label: 'Fenrir', description: '活力充沛' },
  { value: 'Aoede', label: 'Aoede', description: '優雅柔和' }
] as const;

export type ToneValue = typeof TONE_OPTIONS[number]['value'];
export type VoiceValue = typeof VOICE_OPTIONS[number]['value'];

// Live API 模型選項
export const LIVE_API_MODEL_OPTIONS = [
  { value: 'gemini-live-2.5-flash-preview', label: 'Gemini Live 2.5 Flash', description: '標準語音對話模型' },
  { value: 'gemini-2.5-flash-preview-native-audio-dialog', label: 'Native Audio Dialog', description: '原生音頻對話，支援更豐富的語音特性' },
  { value: 'gemini-2.5-flash-exp-native-audio-thinking-dialog', label: 'Native Audio Thinking', description: '包含思考過程的原生音頻模型' }
] as const;

// LLM 模型選項 (用於 STT+TTS 模式的聊天)
export const LLM_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '快速回應，適合一般對話' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: '輕量版本，更快回應' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '專業版本，更強推理能力' }
] as const;

// TTS 模型選項
export const TTS_MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash-preview-tts', label: 'Flash TTS', description: '快速語音合成' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Pro TTS', description: '高品質語音合成' }
] as const;

export type LiveApiModelValue = typeof LIVE_API_MODEL_OPTIONS[number]['value'];
export type LlmModelValue = typeof LLM_MODEL_OPTIONS[number]['value'];
export type TtsModelValue = typeof TTS_MODEL_OPTIONS[number]['value'];

export interface SettingsData {
  tone: ToneValue;
  voice: VoiceValue;
  models: {
    liveApi: LiveApiModelValue;
    llm: LlmModelValue;
    tts: TtsModelValue;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: SettingsData) => void;
  currentSettings: SettingsData;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings
}) => {
  const [tone, setTone] = useState<ToneValue>(currentSettings.tone);
  const [voice, setVoice] = useState<VoiceValue>(currentSettings.voice);
  const [liveApiModel, setLiveApiModel] = useState<LiveApiModelValue>(currentSettings.models.liveApi);
  const [llmModel, setLlmModel] = useState<LlmModelValue>(currentSettings.models.llm);
  const [ttsModel, setTtsModel] = useState<TtsModelValue>(currentSettings.models.tts);
  const [isPlayingPreview, setIsPlayingPreview] = useState<VoiceValue | null>(null);

  // 重設本地狀態當 modal 開啟時
  useEffect(() => {
    if (isOpen) {
      setTone(currentSettings.tone);
      setVoice(currentSettings.voice);
      setLiveApiModel(currentSettings.models.liveApi);
      setLlmModel(currentSettings.models.llm);
      setTtsModel(currentSettings.models.tts);
    }
  }, [isOpen, currentSettings]);

  const handleSave = useCallback(() => {
    onSave({ 
      tone, 
      voice,
      models: {
        liveApi: liveApiModel,
        llm: llmModel,
        tts: ttsModel
      }
    });
    onClose();
  }, [tone, voice, liveApiModel, llmModel, ttsModel, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setTone(currentSettings.tone);
    setVoice(currentSettings.voice);
    setLiveApiModel(currentSettings.models.liveApi);
    setLlmModel(currentSettings.models.llm);
    setTtsModel(currentSettings.models.tts);
    onClose();
  }, [currentSettings, onClose]);

  const handlePlayPreview = useCallback(async (voiceValue: VoiceValue) => {
    // 如果正在播放同一個語音，則停止播放
    if (isPlayingPreview === voiceValue) {
      setIsPlayingPreview(null);
      return;
    }
    
    // 防止同時播放多個語音
    if (isPlayingPreview && isPlayingPreview !== voiceValue) {
      return;
    }
    
    setIsPlayingPreview(voiceValue);
    
    try {
      // 嘗試播放本地音頻檔案
      const audio = new Audio(`/voice-samples/${voiceValue}.wav`);
      
      // 設定音頻屬性
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      const onEnded = () => {
        setIsPlayingPreview(null);
        cleanup();
      };
      
      const onError = () => {
        console.warn(`無法載入語音範例: ${voiceValue}.wav`);
        setIsPlayingPreview(null);
        cleanup();
      };
      
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
      
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      
      await audio.play();
    } catch (error) {
      console.error('播放語音範例失敗:', error);
      setIsPlayingPreview(null);
    }
  }, [isPlayingPreview]);

  // 鍵盤事件處理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel, handleSave]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2>系統設定</h2>
          <button 
            className="settings-modal__close"
            onClick={handleCancel}
            aria-label="關閉設定"
          >
            ✕
          </button>
        </div>
        
        <div className="settings-modal__content">
          {/* 語調設定 */}
          <div className="settings-section">
            <h3>語調設定</h3>
            <p className="settings-section__description">
              選擇 AI 助手的回應語調，會影響對話的系統提示
            </p>
            <div className="radio-group">
              {TONE_OPTIONS.map((option) => (
                <label key={option.value} className="radio-option">
                  <input
                    type="radio"
                    name="tone"
                    value={option.value}
                    checked={tone === option.value}
                    onChange={() => setTone(option.value)}
                  />
                  <span className="radio-label">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 音色設定 */}
          <div className="settings-section">
            <h3>音色設定</h3>
            <p className="settings-section__description">
              選擇 AI 語音合成的音色，點擊試聽按鈕預覽效果
            </p>
            <div className="voice-options">
              {VOICE_OPTIONS.map((option) => (
                <div key={option.value} className="voice-option">
                  <label className="voice-option__info">
                    <input
                      type="radio"
                      name="voice"
                      value={option.value}
                      checked={voice === option.value}
                      onChange={() => setVoice(option.value)}
                    />
                    <div className="voice-option__details">
                      <span className="voice-name">{option.label}</span>
                      <span className="voice-description">{option.description}</span>
                    </div>
                  </label>
                  <button
                    className={`voice-preview-btn ${isPlayingPreview === option.value ? 'playing' : ''}`}
                    onClick={() => handlePlayPreview(option.value)}
                    disabled={isPlayingPreview !== null && isPlayingPreview !== option.value}
                    aria-label={`${isPlayingPreview === option.value ? '停止' : '播放'} ${option.label} 語音範例`}
                  >
                    <span className="play-icon-circle">
                      {isPlayingPreview === option.value ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="4" height="12" />
                          <rect x="14" y="6" width="4" height="12" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 模型設定 */}
          <div className="settings-section">
            <h3>模型設定</h3>
            <p className="settings-section__description">
              選擇不同對話模式下使用的 AI 模型
            </p>
            
            {/* Live API 模型 */}
            <div className="model-subsection">
              <h4>Live API 模型</h4>
              <p className="model-subsection__description">用於即時語音對話</p>
              <div className="radio-group">
                {LIVE_API_MODEL_OPTIONS.map((option) => (
                  <label key={option.value} className="radio-option model-option">
                    <input
                      type="radio"
                      name="liveApiModel"
                      value={option.value}
                      checked={liveApiModel === option.value}
                      onChange={() => setLiveApiModel(option.value)}
                    />
                    <div className="radio-content">
                      <span className="radio-label">{option.label}</span>
                      <span className="radio-description">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* LLM 模型 */}
            <div className="model-subsection">
              <h4>聊天模型 (LLM)</h4>
              <p className="model-subsection__description">用於 STT+TTS 模式的文字對話</p>
              <div className="radio-group">
                {LLM_MODEL_OPTIONS.map((option) => (
                  <label key={option.value} className="radio-option model-option">
                    <input
                      type="radio"
                      name="llmModel"
                      value={option.value}
                      checked={llmModel === option.value}
                      onChange={() => setLlmModel(option.value)}
                    />
                    <div className="radio-content">
                      <span className="radio-label">{option.label}</span>
                      <span className="radio-description">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* TTS 模型 */}
            <div className="model-subsection">
              <h4>語音合成模型 (TTS)</h4>
              <p className="model-subsection__description">用於 STT+TTS 模式的語音合成</p>
              <div className="radio-group">
                {TTS_MODEL_OPTIONS.map((option) => (
                  <label key={option.value} className="radio-option model-option">
                    <input
                      type="radio"
                      name="ttsModel"
                      value={option.value}
                      checked={ttsModel === option.value}
                      onChange={() => setTtsModel(option.value)}
                    />
                    <div className="radio-content">
                      <span className="radio-label">{option.label}</span>
                      <span className="radio-description">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-modal__footer">
          <button className="btn btn--secondary" onClick={handleCancel}>
            取消
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};