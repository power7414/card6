# Google Gemini Live API 對話測試平台

一個專業的多模態 AI 對話平台，基於 Google Gemini API 構建。採用現代化 React 架構，支援**雙模式對話系統**：Live API 即時語音互動和 LLM+TTS 高品質語音回覆，提供靈活的 AI 對話體驗。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0+-orange.svg)](https://zustand.surge.sh/)
[![Testing](https://img.shields.io/badge/Testing-Jest%20%2B%20RTL-green.svg)](https://jestjs.io/)

## ✨ 主要特色

### 🎤 雙模式對話系統

#### **Live API 模式**
- **即時語音對話**: 使用 Gemini Live API 的 WebSocket 連接
- **零延遲體驗**: 語音輸入到 AI 回覆的完整即時流程
- **Session Resumption**: 15分鐘內自動恢復中斷的對話
- **原生音頻處理**: 支援多種 Live API 模型和語音特性

#### **LLM+TTS 模式** 🆕
- **文字輸入對話**: 使用 Gemini Chat API 進行文字對話
- **專業語音合成**: 7種 Gemini TTS 語音選擇 (Zephyr, Puck, Kore 等)
- **自動語音回覆**: AI 回覆會自動使用 TTS 朗讀
- **高品質語音**: 24kHz 專業級語音合成品質

### 💬 智能聊天室管理
- **多聊天室支援**: 創建和管理多個獨立的對話環境
- **智能模式切換**: Live API ↔ LLM+TTS 無縫切換
- **持久化儲存**: IndexedDB 儲存，optimistic updates 提升響應速度
- **連接狀態管理**: 兩種模式都需要手動連接，確保資源控制

### 🎨 專業使用者介面
- **雙欄佈局**: 左側聊天室列表、右側主要對話區域
- **模式選擇器**: 直觀的下拉選單切換對話模式
- **設定面板**: 完整的模型、語音、語調設定選項
- **響應式設計**: 完美適配桌面、平板和手機裝置
- **狀態指示器**: 即時顯示連接、處理、語音播放狀態

### ⚙️ 豐富的設定選項
- **Live API 模型**: 3種模型選擇
- **LLM 模型**: 3種聊天模型選擇
- **TTS 模型**: 2種語音合成模型選擇
- **語音選擇**: 7種專業語音選項
- **語調設定**: 5種語調風格 (活潑、沉穩、熱情、輕鬆、不耐煩)

## 🏗️ 技術架構

### 雙模式 API 整合

| 功能 | Live API 模式 | LLM+TTS 模式 |
|------|--------------|-------------|
| **語音輸入** | Live API WebSocket | ❌ 不支援 |
| **文字輸入** | Live API | Gemini Chat API |
| **語音輸出** | Live API | Gemini TTS API (7種語音) |
| **延遲** | <100ms | ~2秒 (高品質) |
| **品質** | 即時串流 | 專業級品質 |
| **使用場景** | 即時語音對話 | 文字輸入 + 語音回覆 |

### 核心服務層
```
src/services/gemini/
├── gemini-tts.ts       # 專業語音合成 
├── gemini-chat.ts      # 標準對話 API
└── genai-live-client.ts # Live API WebSocket
```

### Hook 系統 (12個核心 Hooks)
- **`use-conversation-mode`**: 模式切換管理
- **`use-gemini-conversation`**: LLM+TTS 完整流程
- **`use-live-api`**: Live API 連接管理
- **`use-chat-manager`**: 聊天室生命週期
- **`use-transcription`**: 轉錄整合邏輯
- **`use-conversation`**: 對話發送功能
- **`use-conversation-events`**: Live API 事件處理
- **`use-session-resumption`**: Session 恢復機制
- **`use-webcam`** / **`use-screen-capture`**: 媒體流控制
- **`use-media-stream-mux`**: 媒體流類型管理
- **`use-azure-openai`**: Azure OpenAI 整合

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
   npm start
   ```

5. **開啟應用程式**
   瀏覽器會自動開啟 `http://localhost:3000`

### 獲取 Gemini API Key

1. 前往 [Google AI Studio](https://ai.google.dev/aistudio)
2. 登入你的 Google 帳戶
3. 創建新專案或選擇現有專案
4. 在 API Keys 區域生成新的 API Key
5. 複製 API Key 並添加到你的 `.env` 檔案

## 📖 使用指南

### 雙模式對話系統

#### 🔄 **Live API 模式** (即時語音對話)
```
1. 選擇「Live API」模式
2. 點擊連接按鈕建立 WebSocket 連接
3. 使用麥克風進行語音對話
4. 支援螢幕分享和攝影機功能
5. 享受零延遲的即時 AI 互動
```
**特點**: 即時串流、無縫對話、自動 session resumption、多媒體支援

#### 🔄 **LLM+TTS 模式** (文字輸入 + 語音回覆)
```
1. 選擇「LLM+TTS」模式  
2. 點擊連接按鈕初始化服務
3. 輸入文字訊息發送
4. AI 回覆將自動使用 TTS 朗讀
```
**特點**: 高品質語音合成、7種語音選擇、專業級音質

### 基本操作

1. **模式切換**
   - 使用頂部下拉選單切換 Live API ↔ LLM+TTS
   - 有活躍連接時無法切換以確保穩定性

2. **設定調整**
   - 點擊設定按鈕開啟設定面板
   - 可選擇不同的 AI 模型、語音、語調
   - 設定會自動保存到本地

3. **多聊天室管理**
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
│   ├── conversation-display/ # 對話顯示
│   └── shared/           # 共用組件
├── hooks/                # 自定義 Hooks (12個)
├── services/             # API 服務層
│   └── gemini/          # Gemini 服務封裝
├── stores/              # Zustand 狀態管理
├── contexts/            # React Context (Settings, LiveAPI)
├── utils/               # 工具函數
└── lib/                 # 工具庫
    ├── indexeddb/       # 數據持久化
    └── worklets/        # Web Audio Worklets
```

### 開發命令
```bash
# 開發服務器
npm start

# 程式碼品質
npm run lint           # ESLint 修復
npm run lint:check     # ESLint 檢查  
npm run type-check     # TypeScript 類型檢查

# 建置和部署
npm run build          # 生產環境建置
```

### 可用的 API 模型

#### Live API 模型選項
- **gemini-live-2.5-flash-preview**: 標準語音對話模型
- **gemini-2.5-flash-preview-native-audio-dialog**: 原生音頻對話
- **gemini-2.5-flash-exp-native-audio-thinking-dialog**: 包含思考過程的對話

#### LLM 模型選項
- **gemini-2.5-flash**: 快速回應，適合一般對話
- **gemini-2.5-flash-lite**: 輕量版本，更快回應
- **gemini-2.5-pro**: 專業版本，更強推理能力

#### TTS 模型選項
- **gemini-2.5-flash-preview-tts**: 快速語音合成
- **gemini-2.5-pro-preview-tts**: 高品質語音合成

#### 語音選項
- **Zephyr**: 清新明亮
- **Puck**: 活潑俏皮
- **Leda**: 溫和穩重
- **Kore**: 專業標準
- **Charon**: 低沉厚重
- **Fenrir**: 活力充沛
- **Aoede**: 優雅柔和

## 🛠️ 故障排除

### 常見問題

**Q: 麥克風無法使用？**
A: 確保瀏覽器已授予麥克風權限，在 Live API 模式下才支援語音輸入

**Q: API 連接失敗？**
A: 檢查 `.env` 檔案中的 `REACT_APP_GEMINI_API_KEY` 設定

**Q: TTS 語音無法播放？**
A: 確保瀏覽器允許自動播放音頻，或手動點擊播放

**Q: 模式無法切換？**
A: 確保沒有活躍的連接，系統會自動解鎖切換功能

### 開發者工具

在開發環境中，您可以使用以下工具：
```javascript
// 瀏覽器控制台
window.sessionDebug.enable()  // 啟用 session 調試
window.sessionDebug.getLogs() // 獲取調試日誌
window.sessionDebug.clear()   // 清除日誌
```

## 🔒 隱私和安全

### API 金鑰安全
- ✅ **環境變數**: API 金鑰不硬編碼在程式碼中
- ✅ **本地處理**: 金鑰僅在客戶端使用
- ✅ **HTTPS 傳輸**: 所有 API 通信使用加密連接

### 數據保護
- ✅ **本地儲存**: 對話記錄僅保存在瀏覽器本地
- ✅ **無伺服器依賴**: 直接與 Google API 通信
- ✅ **即時清理**: 音頻資料處理後立即釋放

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
- ✅ 語義化版本控制

## 📄 授權

此專案基於 MIT 授權 - 查看 [LICENSE](LICENSE) 檔案以了解詳情。

## 🙏 致謝

- [Google Gemini API](https://ai.google.dev/) - 強大的 AI 能力
- [React](https://reactjs.org/) - 現代化前端框架  
- [Zustand](https://zustand.surge.sh/) - 輕量級狀態管理
- [Web Audio API](https://developer.mozilla.org/docs/Web/API/Web_Audio_API) - 高級音頻處理

---

**🎯 使用雙模式對話系統，體驗 Live API 即時互動與 LLM+TTS 專業語音合成！**