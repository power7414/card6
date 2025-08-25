/**
 * Azure OpenAI 測試組件
 * 用於測試和驗證 Azure OpenAI API 連接
 */

import React, { useState } from 'react';
import { useAzureOpenAI } from '../../hooks/use-azure-openai';
import './debug-components.scss';

export const AzureOpenAITest: React.FC = () => {
  const [testMessage, setTestMessage] = useState('你好，請介紹一下你自己。');
  const [streamResponse, setStreamResponse] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const azureOpenAI = useAzureOpenAI(
    '你是一個專業的 AI 助手，用繁體中文回覆使用者。',
    { temperature: 0.7, max_tokens: 500 }
  );

  const handleSendMessage = async () => {
    if (!testMessage.trim()) return;

    try {
      const response = await azureOpenAI.sendMessage(testMessage);
      console.log('Azure OpenAI 回應:', response);
    } catch (error) {
      console.error('發送訊息失敗:', error);
    }
  };

  const handleStreamMessage = async () => {
    if (!testMessage.trim()) return;

    setStreamResponse('');
    
    try {
      await azureOpenAI.sendStreamMessage(
        testMessage,
        (chunk: string) => {
          setStreamResponse(prev => prev + chunk);
        }
      );
    } catch (error) {
      console.error('串流訊息失敗:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
    } else {
      alert('請選擇音頻檔案');
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      alert('請先選擇音頻檔案');
      return;
    }

    try {
      const transcript = await azureOpenAI.transcribeAudio(audioFile, 'zh');
      console.log('轉錄結果:', transcript);
    } catch (error) {
      console.error('轉錄失敗:', error);
    }
  };

  const handleHealthCheck = async () => {
    const isHealthy = await azureOpenAI.checkHealth();
    console.log('健康檢查結果:', isHealthy ? '正常' : '異常');
  };

  return (
    <div className="azure-openai-test">
      <h3>🔬 Azure OpenAI API 測試</h3>
      
      {/* 健康檢查 */}
      <div className="test-section">
        <h4>服務健康檢查</h4>
        <button 
          onClick={handleHealthCheck}
          disabled={azureOpenAI.isLoading}
          className="test-button"
        >
          {azureOpenAI.isLoading ? '檢查中...' : '檢查服務狀態'}
        </button>
      </div>

      {/* 對話測試 */}
      <div className="test-section">
        <h4>對話測試</h4>
        <div className="input-group">
          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="輸入測試訊息..."
            className="test-textarea"
            rows={3}
          />
          <div className="button-group">
            <button 
              onClick={handleSendMessage}
              disabled={azureOpenAI.isLoading || !testMessage.trim()}
              className="test-button"
            >
              {azureOpenAI.isLoading ? '發送中...' : '發送訊息'}
            </button>
            <button 
              onClick={handleStreamMessage}
              disabled={azureOpenAI.isLoading || !testMessage.trim()}
              className="test-button"
            >
              {azureOpenAI.isLoading ? '串流中...' : '串流訊息'}
            </button>
          </div>
        </div>
      </div>

      {/* 語音轉文字測試 */}
      <div className="test-section">
        <h4>語音轉文字測試</h4>
        <div className="input-group">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="file-input"
          />
          {audioFile && (
            <p className="file-info">
              已選擇檔案: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          <button 
            onClick={handleTranscribe}
            disabled={azureOpenAI.isLoading || !audioFile}
            className="test-button"
          >
            {azureOpenAI.isLoading ? '轉錄中...' : '開始轉錄'}
          </button>
        </div>
      </div>

      {/* 結果顯示 */}
      <div className="results-section">
        <h4>結果顯示</h4>
        
        {azureOpenAI.error && (
          <div className="error-result">
            <strong>錯誤:</strong> {azureOpenAI.error}
            <button onClick={azureOpenAI.clearError} className="clear-error-btn">✕</button>
          </div>
        )}

        {azureOpenAI.lastResponse && (
          <div className="success-result">
            <strong>最後回應:</strong>
            <pre>{azureOpenAI.lastResponse}</pre>
          </div>
        )}

        {streamResponse && (
          <div className="stream-result">
            <strong>串流回應:</strong>
            <pre>{streamResponse}</pre>
          </div>
        )}
      </div>

      {/* 狀態指示器 */}
      <div className="status-section">
        <div className={`status-indicator ${azureOpenAI.isLoading ? 'loading' : 'idle'}`}>
          {azureOpenAI.isLoading ? '🔄 處理中...' : '✅ 準備就緒'}
        </div>
      </div>

      {/* 開發者資訊 */}
      <details className="dev-info">
        <summary>開發者資訊</summary>
        <div className="dev-content">
          <p><strong>API 端點:</strong> Azure OpenAI</p>
          <p><strong>部署名稱:</strong> 9h00100-voicebot-gpt-4.1</p>
          <p><strong>API 版本:</strong> 2025-01-01-preview</p>
          <p><strong>支援功能:</strong> Chat Completions, Whisper STT, Stream Chat</p>
          <p><strong>使用方式:</strong></p>
          <ul>
            <li>在瀏覽器控制台中執行 <code>azureOpenAIExamples.checkHealth()</code></li>
            <li>使用 <code>useAzureOpenAI</code> hook 在 React 組件中整合</li>
            <li>直接使用 <code>azureOpenAIService</code> 服務類別</li>
          </ul>
        </div>
      </details>
    </div>
  );
};