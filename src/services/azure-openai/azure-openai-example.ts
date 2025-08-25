/**
 * Azure OpenAI 服務使用範例
 * 展示如何使用 Chat Completions 和 Whisper STT
 */

import { azureOpenAIService, ChatMessage } from './azure-openai-service';

/**
 * 範例：使用 Azure OpenAI 進行對話
 */
export async function exampleChatCompletion(): Promise<void> {
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一個專業的 AI 助手，用繁體中文回覆使用者。'
      },
      {
        role: 'user',
        content: '請介紹一下台灣的美食文化。'
      }
    ];

    const response = await azureOpenAIService.chatCompletion({
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    console.log('Azure OpenAI 回應:', response.choices[0].message.content);
    console.log('Token 使用量:', response.usage);
  } catch (error) {
    console.error('對話完成錯誤:', error);
  }
}

/**
 * 範例：使用 Azure OpenAI Whisper 進行語音轉文字
 */
export async function exampleWhisperSTT(audioFile: File): Promise<void> {
  try {
    const response = await azureOpenAIService.transcribeAudio({
      file: audioFile,
      language: 'zh', // 中文
      response_format: 'verbose_json',
      temperature: 0,
    });

    console.log('轉錄結果:', response.text);
    if (response.words) {
      console.log('詳細時間軸:', response.words);
    }
  } catch (error) {
    console.error('語音轉文字錯誤:', error);
  }
}

/**
 * 範例：使用串流式對話
 */
export async function exampleStreamChat(userMessage: string): Promise<void> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: '你是一個專業的 AI 助手。'
    },
    {
      role: 'user',
      content: userMessage
    }
  ];

  let fullResponse = '';

  await azureOpenAIService.chatCompletionStream(
    {
      messages,
      max_tokens: 500,
      temperature: 0.7,
    },
    // onChunk: 每次收到新的文字片段
    (chunk: string) => {
      fullResponse += chunk;
      console.log('收到片段:', chunk);
    },
    // onComplete: 串流完成
    () => {
      console.log('完整回應:', fullResponse);
    },
    // onError: 錯誤處理
    (error: Error) => {
      console.error('串流錯誤:', error);
    }
  );
}

/**
 * 範例：檢查 Azure OpenAI 服務健康狀態
 */
export async function checkAzureOpenAIHealth(): Promise<void> {
  console.log('檢查 Azure OpenAI 服務狀態...');
  
  const isHealthy = await azureOpenAIService.checkHealth();
  
  if (isHealthy) {
    console.log('✅ Azure OpenAI 服務運作正常');
  } else {
    console.log('❌ Azure OpenAI 服務無法連接');
  }
}

// 在瀏覽器控制台中使用的全域函數
if (process.env.NODE_ENV === 'development') {
  (window as any).azureOpenAIExamples = {
    chatCompletion: exampleChatCompletion,
    whisperSTT: exampleWhisperSTT,
    streamChat: exampleStreamChat,
    checkHealth: checkAzureOpenAIHealth,
  };
  
  console.log('🚀 Azure OpenAI 範例已載入！在控制台中使用:');
  console.log('- azureOpenAIExamples.checkHealth() - 檢查服務狀態');
  console.log('- azureOpenAIExamples.chatCompletion() - 對話完成範例');
  console.log('- azureOpenAIExamples.streamChat("你好") - 串流對話範例');
}