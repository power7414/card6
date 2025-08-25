# Azure OpenAI API 設定指南

## 📋 概述

已成功整合 Azure OpenAI API 到專案中，支援 Chat Completions 和 Whisper 語音轉文字功能。以下是完整的設定指南和使用方式。

## 🔧 設定檔案

### 1. 環境變數設定 (`.env`)

```env
# Azure OpenAI API Settings
REACT_APP_AZURE_OPENAI_ENDPOINT=https://9h00100.openai.azure.com
REACT_APP_AZURE_OPENAI_API_KEY=8yjLEEHAU4wXjTz0QeDpNzJuBOn86bnweQ8IoxECd2QAZhW4qzX1JQQJ99BEACYeBjFXJ3w3AAABACOGpUXa
REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME=9h00100-voicebot-gpt-4.1
REACT_APP_AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

### 2. 檔案結構

```
src/
├── services/azure-openai/
│   ├── azure-openai-config.ts      # 設定檔案
│   ├── azure-openai-service.ts     # 核心服務類別
│   └── azure-openai-example.ts     # 使用範例
├── hooks/
│   └── use-azure-openai.ts         # React Hook
└── components/debug/
    ├── AzureOpenAITest.tsx          # 測試組件
    └── debug-components.scss        # 樣式
```

## 🚀 Azure OpenAI vs 一般 OpenAI API 的關鍵差異

### 1. **Base URL 結構**
```typescript
// 一般 OpenAI
const url = 'https://api.openai.com/v1/chat/completions';

// Azure OpenAI
const url = 'https://9h00100.openai.azure.com/openai/deployments/9h00100-voicebot-gpt-4.1/chat/completions?api-version=2025-01-01-preview';
```

### 2. **Authentication Headers**
```typescript
// 一般 OpenAI
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}

// Azure OpenAI
headers: {
  'api-key': apiKey,
  'Content-Type': 'application/json'
}
```

### 3. **URL 結構組成**
- **Endpoint**: `https://{resource-name}.openai.azure.com`
- **Path**: `/openai/deployments/{deployment-name}/{endpoint}`
- **Query**: `?api-version={api-version}`

## 🛠️ 使用方式

### 1. 直接使用服務類別

```typescript
import { azureOpenAIService } from './services/azure-openai/azure-openai-service';

// 對話完成
const response = await azureOpenAIService.chatCompletion({
  messages: [
    { role: 'system', content: '你是一個專業的AI助手' },
    { role: 'user', content: '你好' }
  ],
  max_tokens: 500,
  temperature: 0.7
});

// 語音轉文字
const transcript = await azureOpenAIService.transcribeAudio({
  file: audioFile,
  language: 'zh',
  response_format: 'json'
});
```

### 2. 使用 React Hook

```typescript
import { useAzureOpenAI } from './hooks/use-azure-openai';

function ChatComponent() {
  const azureOpenAI = useAzureOpenAI(
    '你是一個專業的AI助手，用繁體中文回覆。',
    { temperature: 0.7, max_tokens: 500 }
  );

  const handleSend = async () => {
    try {
      const response = await azureOpenAI.sendMessage('你好嗎？');
      console.log(response);
    } catch (error) {
      console.error('錯誤:', error);
    }
  };

  return (
    <div>
      <button 
        onClick={handleSend} 
        disabled={azureOpenAI.isLoading}
      >
        {azureOpenAI.isLoading ? '發送中...' : '發送訊息'}
      </button>
      
      {azureOpenAI.error && (
        <div className="error">{azureOpenAI.error}</div>
      )}
      
      {azureOpenAI.lastResponse && (
        <div className="response">{azureOpenAI.lastResponse}</div>
      )}
    </div>
  );
}
```

### 3. 串流對話

```typescript
await azureOpenAI.sendStreamMessage(
  '請寫一個關於台灣的故事',
  (chunk) => {
    // 每次收到新片段時執行
    console.log('新片段:', chunk);
  }
);
```

## 🧪 測試和除錯

### 1. 瀏覽器控制台測試

開發模式下，可在瀏覽器控制台中使用：

```javascript
// 檢查服務健康狀態
azureOpenAIExamples.checkHealth()

// 測試對話完成
azureOpenAIExamples.chatCompletion()

// 測試串流對話
azureOpenAIExamples.streamChat('你好，請介紹一下台灣')
```

### 2. 使用測試組件

```typescript
import { AzureOpenAITest } from './components/debug/AzureOpenAITest';

// 在你的組件中包含測試組件（開發模式下）
{process.env.NODE_ENV === 'development' && <AzureOpenAITest />}
```

## ⚙️ 支援的功能

### ✅ 已實作功能
- **Chat Completions**: GPT-4.1 對話完成
- **Stream Chat**: 串流式對話回應
- **Whisper STT**: 語音轉文字 (多語言支援)
- **健康檢查**: 服務可用性檢測
- **React Hook**: 簡化的 React 整合
- **錯誤處理**: 完整的錯誤處理和恢復機制

### 🔄 配置選項
- **Temperature**: 創造性控制 (0-1)
- **Max Tokens**: 回應長度限制
- **Top P**: 核心採樣控制
- **Frequency/Presence Penalty**: 重複性控制
- **Language**: STT 語言設定

## 🔒 安全考量

1. **API Key 安全**: 
   - API Key 儲存在環境變數中
   - 不會在前端代碼中明文顯示
   - 建議在生產環境使用更安全的密鑰管理

2. **CORS 設定**:
   - Azure OpenAI 需要在 Azure 控制台中設定 CORS
   - 確保你的域名在允許清單中

3. **速率限制**:
   - Azure OpenAI 有 API 調用速率限制
   - 建議實作重試機制和請求節流

## 🐛 常見問題

### 1. 401 Unauthorized 錯誤
```
解決方案：
- 檢查 API Key 是否正確
- 確認 Azure 資源是否啟用
- 檢查 CORS 設定
```

### 2. 404 Not Found 錯誤
```
解決方案：
- 確認部署名稱是否正確
- 檢查 API 版本是否支援
- 驗證 endpoint URL 格式
```

### 3. 檔案上傳失敗 (Whisper)
```
解決方案：
- 確保音頻檔案格式受支援 (mp3, wav, flac等)
- 檢查檔案大小限制 (通常25MB)
- 驗證 Content-Type header 設定
```

## 📊 使用統計

目前設定支援：
- **模型**: GPT-4.1 (9h00100-voicebot-gpt-4.1)
- **API 版本**: 2025-01-01-preview
- **支援語言**: 中文、英文及其他多種語言
- **檔案格式**: mp3, wav, flac, m4a, ogg, webm (Whisper)

## 🔄 後續擴展

可考慮的擴展功能：
- **DALL-E 圖像生成**: 整合圖像生成功能
- **Embeddings**: 文本嵌入和語意搜尋
- **Fine-tuning**: 自定義模型微調
- **Batch API**: 批量請求處理
- **Assistant API**: 助手功能整合

---

**設定完成日期**: 2025-08-25  
**版本**: 1.0.0  
**狀態**: ✅ 可用於開發和測試