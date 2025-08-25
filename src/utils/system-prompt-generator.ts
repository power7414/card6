import { ToneValue } from '../components/shared/SettingsModal';

/**
 * 根據語調設定生成對應的系統提示
 */
export function generateSystemPrompt(tone: ToneValue): string {
  const baseTonePrompt = getTonePrompt(tone);
  
  return `${baseTonePrompt}你是一個友善且樂於助人的 AI 助手。請用繁體中文回應。
        
請遵循以下指示：
- 保持對話友善和專業
- 提供清晰、準確的資訊
- 如果不確定某個問題的答案，請誠實說明
- 保持回應簡潔且相關
- 使用台灣慣用的繁體中文用詞`;
}

/**
 * 根據語調類型獲取對應的提示語句
 */
function getTonePrompt(tone: ToneValue): string {
  const tonePrompts: Record<ToneValue, string> = {
    'lively': '你很搞笑，盡量語氣活潑。',
    'calm': '請保持語氣沉穩冷靜。',
    'passionate': '請用熱情洋溢的語氣回應。',
    'relaxed': '請用輕鬆隨性的語氣回應。',
    'impatient': '請用略帶不耐煩的語氣回應。'
  };
  
  return tonePrompts[tone] || tonePrompts['lively'];
}

/**
 * 根據語調設定生成 TTS 風格提示
 */
export function generateTTSStylePrompt(tone: ToneValue): string {
  const stylePrompts: Record<ToneValue, string> = {
    'lively': '用活潑搞笑的語調說話',
    'calm': '用沉穩冷靜的語調說話',
    'passionate': '用熱情洋溢的語調說話',
    'relaxed': '用輕鬆隨性的語調說話',
    'impatient': '用略帶不耐煩的語調說話'
  };
  
  return stylePrompts[tone] || stylePrompts['lively'];
}