# Google Gemini Live API 對話測試平台

一個專業的多模態 AI 對話平台，基於 Google Gemini Live API 構建。採用現代化 React 架構，支援**雙模式對話系統**：Live API 即時互動和 STT+TTS 分離式處理，提供靈活的語音對話體驗。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0+-orange.svg)](https://zustand.surge.sh/)
[![Testing](https://img.shields.io/badge/Testing-Jest%20%2B%20RTL-green.svg)](https://jestjs.io/)

## ✨ 主要特色

### 🎤 雙模式語音對話系統
#### **Live API 模式**
- **即時語音對話**: 使用 Gemini Live API 的 WebSocket 連接
- **零延遲體驗**: 語音輸入到 AI 回覆的完整即時流程
- **Session Resumption**: 15分鐘內自動恢復中斷的對話

#### **STT+TTS 模式** 🆕
- **分段語音識別**: 使用 Gemini Audio API 進行高品質語音轉文字
- **專業語音合成**: 30 種 Gemini TTS 語音選擇 (Kore, Zephyr, Puck 等)
- **近即時處理**: 3秒分段錄音，平衡品質與響應速度
- **多語言支援**: 智能語言檢測和自然語音風格

### 💬 智能聊天室管理
- **多聊天室支援**: 創建和管理多個獨立的對話環境
- **智能模式切換**: Live API ↔ STT+TTS 無縫切換
- **持久化儲存**: IndexedDB 儲存，optimistic updates 提升響應速度
- **音頻生命週期管理**: 用完即丟的隱私保護設計

### 🎙️ 高級音頻處理
- **專業錄音**: MediaRecorder API + 16kHz 高品質採樣
- **多格式支援**: WAV, MP3, FLAC, AAC, OGG, AIFF
- **音頻視覺化**: 即時頻譜分析和波形顯示
- **自動音頻清理**: 處理完畢立即釋放記憶體

### 🎨 專業使用者介面
- **雙欄佈局**: 左側聊天室列表、右側主要對話區域
- **模式選擇器**: 直觀的下拉選單切換對話模式
- **響應式設計**: 完美適配桌面、平板和手機裝置
- **狀態指示器**: 即時顯示錄音、轉錄、語音合成狀態

## 🏗️ 技術架構

### 雙模式 API 整合

| 功能 | Live API 模式 | STT+TTS 模式 |
|------|--------------|-------------|
| **語音輸入** | Live API WebSocket | Gemini Audio API (分段處理) |
| **文字對話** | Live API | Gemini Chat API (gemini-2.5-flash) |
| **語音輸出** | Live API | Gemini TTS API (30種語音) |
| **延遲** | <100ms | ~3秒 (高品質) |
| **品質** | 即時串流 | 專業級品質 |

### 核心服務層
```
src/services/gemini/
├── gemini-stt.ts    # 分段錄音 + Audio API
├── gemini-tts.ts    # 30種語音 + 語音合成 
├── gemini-chat.ts   # 標準對話 API
└── genai-live-client.ts # Live API WebSocket
```

### Hook 系統 (9個核心 Hooks)
- **`use-conversation-mode`**: 模式切換管理
- **`use-gemini-conversation`**: STT+TTS 完整流程
- **`use-live-api`**: Live API 連接管理
- **`use-chat-manager`**: 聊天室生命週期
- **`use-transcription`**: 轉錄整合邏輯
- **`use-session-resumption`**: Session 恢復機制
- **`use-webcam`** / **`use-screen-capture`**: 媒體流控制
- **`use-media-stream-mux`**: 媒體流類型管理

## 🚀 快速開始

### 前置需求
- **Node.js** 16.x 或更高版本
- **npm** 或 **yarn** 包管理器
- **Google Gemini API Key** (從 Google AI Studio 獲取)
- **支援的瀏覽器** (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd conversation-testing-platform
   ```

2. **安裝相依套件**
   ```bash
   npm install
   ```

3. **配置環境變數**
   創建 `.env` 檔案並設定你的 API 金鑰：
   ```env
   REACT_APP_GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **啟動開發服務器**
   ```bash
   # HTTP 模式 (適合基本功能測試)
   npm start
   
   # HTTPS 模式 (媒體功能需要 HTTPS)
   npm run start-https
   ```

5. **開啟應用程式**
   瀏覽器會自動開啟：
   - HTTP: `http://localhost:3000`
   - HTTPS: `https://localhost:3000`

### 獲取 Gemini API Key

1. 前往 [Google AI Studio](https://ai.google.dev/aistudio)
2. 登入你的 Google 帳戶
3. 創建新專案或選擇現有專案
4. 在 API Keys 區域生成新的 API Key
5. 複製 API Key 並添加到你的 `.env` 檔案

## 📖 使用指南

### 雙模式對話系統

#### 🔄 **Live API 模式** (推薦即時對話)
```
1. 選擇「Live API」模式
2. 點擊連接按鈕建立 WebSocket 連接
3. 開始語音對話或文字輸入
4. 享受零延遲的即時 AI 互動
```
**特點**: 即時串流、無縫對話、自動 session resumption

#### 🔄 **STT+TTS 模式** (推薦高品質語音)
```
1. 選擇「STT + TTS」模式  
2. 點擊麥克風開始錄音 (自動 3秒分段處理)
3. 即時看到轉錄文字顯示
4. AI 回覆將用專業語音朗讀
```
**特點**: 高品質轉錄、30種語音選擇、多語言支援

### 基本操作

1. **模式切換**
   - 使用頂部下拉選單切換 Live API ↔ STT+TTS
   - 有活躍連接時無法切換以確保穩定性

2. **語音輸入**
   - **Live API**: 點擊麥克風即時對話
   - **STT+TTS**: 點擊麥克風自動分段錄音和轉錄

3. **文字輸入**
   - 兩種模式都支援文字輸入
   - STT+TTS 模式會自動朗讀 AI 回覆

4. **多聊天室管理**
   - 左側面板創建、切換、重命名聊天室
   - 每個聊天室獨立保存對話歷史

## 🔧 開發指南

### 項目結構
```
src/
├── components/
│   ├── layout/           # 佈局組件
│   ├── chat-input/       # 輸入控制組件
│   ├── audio-visualizer/ # 音頻視覺化
│   └── shared/           # 共用組件
├── hooks/                # 自定義 Hooks (9個)
├── services/             # API 服務層
│   └── gemini/          # Gemini 服務封裝
├── stores/              # Zustand 狀態管理
├── contexts/            # React Context
└── lib/                 # 工具庫
    ├── indexeddb/       # 數據持久化
    └── worklets/        # Web Audio Worklets
```

### 開發命令
```bash
# 開發服務器
npm start
npm run start-https

# 程式碼品質
npm run lint           # ESLint 修復
npm run lint:check     # ESLint 檢查
npm run type-check     # TypeScript 類型檢查

# 建置和部署
npm run build          # 生產環境建置
npm run bundle-analyzer # 分析打包大小
```

### API 使用費用

| 模式 | STT 費用 | Chat 費用 | TTS 費用 | 總計 |
|------|---------|----------|---------|------|
| **Live API** | ✅ 包含 | ✅ 包含 | ✅ 包含 | 💰 Live API 計費 |
| **文字輸入 (STT+TTS)** | ❌ 無 | ✅ 有 | ✅ 有 | 💰 Chat + TTS |
| **語音輸入 (STT+TTS)** | ✅ 有 | ✅ 有 | ✅ 有 | 💰 三個 API |

## 🔒 隱私和安全

### 音頻數據保護
- ✅ **零本地存儲**: 所有音頻檔案臨時處理
- ✅ **自動清理**: 處理完畢立即釋放記憶體
- ✅ **用完即丟**: 無痕跡音頻處理設計

### API 金鑰安全
- ✅ **環境變數**: API 金鑰不硬編碼在程式碼中
- ✅ **本地處理**: 金鑰僅在客戶端使用
- ✅ **HTTPS 傳輸**: 所有 API 通信使用加密連接

## 🛠️ 故障排除

### 常見問題

**Q: 麥克風無法使用？**
A: 確保瀏覽器已授予麥克風權限，HTTPS 環境下媒體功能更穩定

**Q: API 連接失敗？**
A: 檢查 `.env` 檔案中的 `REACT_APP_GEMINI_API_KEY` 設定

**Q: 語音品質不佳？**
A: STT+TTS 模式提供更高語音品質，可切換嘗試

**Q: 模式無法切換？**
A: 確保沒有活躍的錄音或連接，系統會自動解鎖

### 開發者工具

在開發環境中，您可以使用以下工具：
```javascript
// 瀏覽器控制台
window.sessionDebug.enable()  // 啟用 session 調試
window.sessionDebug.getLogs() // 獲取調試日誌
window.sessionDebug.clear()   // 清除日誌
```

## 🤝 貢獻指南

我們歡迎社區貢獻！請遵循以下步驟：

1. Fork 此專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 開發標準
- ✅ TypeScript 嚴格模式
- ✅ ESLint + Prettier 程式碼格式化
- ✅ Jest + RTL 測試覆蓋
- ✅ 語義化版本控制

## 📄 授權

此專案基於 MIT 授權 - 查看 [LICENSE](LICENSE) 檔案以了解詳情。

## 🙏 致謝

- [Google Gemini API](https://ai.google.dev/) - 強大的 AI 能力
- [React](https://reactjs.org/) - 現代化前端框架  
- [Zustand](https://zustand.surge.sh/) - 輕量級狀態管理
- [Web Audio API](https://developer.mozilla.org/docs/Web/API/Web_Audio_API) - 高級音頻處理

---

**🎯 使用雙模式對話系統，享受最佳的 AI 語音互動體驗！**