# Google Gemini Live API 對話測試平台

一個專業的多模態 AI 對話平台，基於 Google Gemini Live API 構建，支援即時語音對話、多聊天室管理、session resumption 和高級音頻視覺化功能。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://reactjs.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0+-orange.svg)](https://zustand.surge.sh/)
[![Testing](https://img.shields.io/badge/Testing-Jest%20%2B%20RTL-green.svg)](https://jestjs.io/)

## ✨ 主要特色

### 🎤 多模態實時互動
- **語音對話**: 即時語音輸入與 AI 語音回應
- **視頻整合**: 攝影機視頻流支援，可與 AI 進行視覺互動
- **螢幕分享**: 分享螢幕內容供 AI 分析和討論
- **檔案上傳**: 支援多種檔案格式的上傳和分析

### 💬 智能聊天室管理
- **多聊天室支援**: 創建和管理多個獨立的對話環境
- **快速切換**: 在不同對話間快速切換，保持各自的狀態
- **持久化儲存**: 使用 IndexedDB 完整保存對話歷史
- **Session Resumption**: 支援對話 session 的中斷和恢復

### 🎙️ 高級轉錄功能
- **即時轉錄**: 語音轉文字的即時顯示
- **轉錄編輯**: 可編輯轉錄文字後再發送
- **多語言支援**: 支援繁體中文、英文等多種語言
- **音頻視覺化**: 豐富的音頻波形和脈衝視覺效果

### 🎨 專業使用者介面
- **三欄佈局**: 左側聊天室列表、中間對話區、右側除錯面板
- **響應式設計**: 完美適配桌面、平板和手機裝置
- **收合面板**: 可隱藏側邊欄以獲得更大的對話空間
- **深色主題**: 護眼的深色界面設計，適合長時間使用

### 🔧 開發者工具
- **控制台日誌**: 查看系統運行狀態和除錯資訊
- **語法高亮**: 支援多種程式語言的語法高亮顯示
- **篩選搜索**: 快速定位和分析問題
- **除錯模式**: 提供開發測試和診斷工具

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

### 基本操作流程

1. **連接 Live API**
   - 啟動應用後，點擊頂部的連接狀態按鈕
   - 確認 API Key 正確設定後建立連接

2. **創建新對話**
   - 點擊左側面板的「新對話」按鈕
   - 系統會自動創建並切換到新的聊天室

3. **開始對話**
   - **文字輸入**: 在底部輸入框中輸入文字，按 Enter 發送
   - **語音輸入**: 點擊麥克風按鈕開始錄音 (需要 Live API 連接)
   - **檔案上傳**: 點擊附件圖標上傳檔案供 AI 分析

### 進階功能使用

#### 媒體控制
- **攝影機**: 點擊攝影機圖標啟用視頻流，與 AI 進行視覺互動
- **螢幕分享**: 點擊螢幕圖標分享螢幕內容
- **音頻視覺化**: 觀察即時的音頻波形和視覺效果

#### 聊天室管理
- **切換聊天室**: 點擊左側列表中的任何聊天室項目
- **重命名**: 右鍵點擊聊天室名稱進行重命名
- **刪除**: 選擇聊天室後點擊刪除按鈕 (不可恢復)

#### 介面自定義
- **收合面板**: 點擊面板邊緣的箭頭按鈕收合或展開
- **調整欄寬**: 拖拽面板之間的分隔線調整寬度
- **控制台面板**: 在右側面板查看系統日誌和除錯資訊

## 🏗️ 專案架構

```
src/
├── components/                  # React 組件
│   ├── layout/                 # 佈局相關組件
│   │   ├── Header.tsx
│   │   ├── ThreeColumnLayout.tsx
│   │   └── TwoColumnLayout.tsx
│   ├── chat-room-sidebar/      # 聊天室側邊欄
│   │   ├── ChatSidebar.tsx
│   │   ├── ChatList.tsx
│   │   ├── ChatItem.tsx
│   │   └── NewChatButton.tsx
│   ├── conversation-display/   # 對話顯示區域
│   │   ├── ConversationArea.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── TranscriptionDisplay.tsx
│   │   └── TypingIndicator.tsx
│   ├── chat-input/            # 輸入控制區域
│   │   ├── ChatInputArea.tsx
│   │   ├── ControlTray.tsx
│   │   ├── MediaControlBar.tsx
│   │   ├── TextInput.tsx
│   │   └── SendButton.tsx
│   ├── console-sidebar/       # 除錯控制台
│   │   ├── ConsoleSidebar.tsx
│   │   ├── Logger.tsx
│   │   └── SyntaxHighlighter.tsx
│   ├── audio-visualizer/      # 音頻視覺化
│   │   └── AIAudioVisualizer.tsx
│   ├── audio-pulse/           # 音頻脈衝效果
│   │   └── AudioPulse.tsx
│   ├── wave-animation/        # 波形動畫
│   │   └── WaveAnimation.tsx
│   ├── debug/                 # 除錯工具
│   │   └── ToggleTest.tsx
│   └── shared/               # 共用組件
│       ├── ErrorBoundary.tsx
│       ├── CollapsiblePanel.tsx
│       └── TypewriterText.tsx
├── hooks/                    # 自定義 React Hooks
│   ├── use-live-api.ts      # Live API 整合
│   ├── use-chat-manager.ts  # 聊天管理
│   ├── use-transcription.ts # 轉錄功能
│   └── use-session-resumption.ts # Session 恢復
├── stores/                  # Zustand 狀態管理
│   ├── chat-store-persistent.ts # 持久化聊天狀態儲存
│   └── ui-store.ts          # 使用者介面狀態
├── contexts/               # React Context
│   └── LiveAPIContext.tsx  # Live API 上下文
├── lib/                   # 核心函式庫
│   ├── indexeddb/         # 數據庫操作
│   ├── worklets/          # Audio Worklets
│   ├── audio-recorder.ts  # 音頻錄製
│   └── genai-live-client.ts # Gemini 客戶端
├── types/                 # TypeScript 類型定義
│   ├── chat.ts
│   └── transcription.ts
└── styles/               # 樣式檔案
    └── variables.scss
```

## 🛠️ 開發指令

```bash
# 開發相關
npm start                 # 啟動開發服務器 (HTTP)
npm run start-https       # 啟動開發服務器 (HTTPS)
npm run build            # 建置生產版本
npm run type-check       # TypeScript 類型檢查

# 測試相關
npm test                 # 執行所有測試
npm run test:watch       # 監視模式執行測試
npm run test:coverage    # 執行測試並生成覆蓋率報告
npm run test:unit        # 只執行單元測試
npm run test:integration # 只執行整合測試

# 程式碼品質
npm run lint            # 執行 ESLint 檢查
npm run lint:check      # 檢查程式碼風格問題

# 其他工具
npm run bundle-analyzer # 分析 bundle 大小
```

## 📱 響應式設計支援

### 桌面版 (>1024px)
- 完整三欄佈局顯示
- 所有功能完全可用
- 最佳的使用體驗

### 平板版 (768px-1024px)
- 左側面板自動收合
- 保持主要功能可用性
- 觸控操作優化

### 手機版 (<768px)
- 全螢幕對話介面
- 側邊欄變為浮動抽屜
- 簡化的操作介面

## 🎨 自定義主題

專案使用 SCSS 變數系統，可輕鬆自定義主題：

```scss
// 在 src/styles/variables.scss 中修改
:root {
  --bg-primary: #0a0a0a;      // 主背景色
  --bg-secondary: #1a1a1a;    // 次背景色  
  --bg-tertiary: #2a2a2a;     // 第三背景色
  --text-primary: #ffffff;    // 主文字色
  --text-secondary: #cccccc;  // 次文字色
  --accent-color: #4285f4;    // 強調色
  --border-color: #333333;    // 邊框色
  --error-color: #ff6b6b;     // 錯誤色
  --success-color: #4ecdc4;   // 成功色
  --warning-color: #ffe66d;   // 警告色
}
```

## 🔧 故障排除

### 常見問題解決

#### API 連接問題
```bash
問題: "Failed to connect to Live API"
解決方案:
1. 檢查 .env 檔案中的 API Key 是否正確
2. 確認網路連接正常
3. 檢查 API Key 是否有足夠的權限和配額
```

#### 音頻功能問題
```bash
問題: 麥克風無法使用
解決方案:
1. 使用 HTTPS 連接 (npm run start-https)
2. 在瀏覽器中允許麥克風權限
3. 檢查音頻裝置是否正常工作
```

#### 效能問題
```bash
問題: 頁面載入緩慢或卡頓
解決方案:
1. 清除瀏覽器快取和 localStorage
2. 檢查是否有大量的對話歷史資料
3. 嘗試在無痕模式下使用
```

### 瀏覽器支援

| 瀏覽器 | 最低版本 | 推薦版本 | 注意事項 |
|--------|----------|----------|----------|
| Chrome | 90+ | 最新版 | 完整功能支援 |
| Firefox | 88+ | 最新版 | 部分 WebRTC 功能可能受限 |
| Safari | 14+ | 最新版 | 需要允許音頻權限 |
| Edge | 90+ | 最新版 | 完整功能支援 |

## 🧪 測試

專案包含完整的測試套件：

```bash
# 執行所有測試
npm test

# 特定類型的測試
npm run test:unit        # 單元測試
npm run test:integration # 整合測試
npm run test:component   # 組件測試
npm run test:hooks      # Hook 測試

# 測試覆蓋率
npm run test:coverage   # 生成覆蓋率報告
```

### 測試覆蓋率目標
- **組件測試**: >90%
- **Hook 測試**: >85%
- **工具函數**: >95%
- **整體覆蓋率**: >80%

## 📈 效能監控

### 關鍵效能指標
- **首次內容繪製** (FCP): <2 秒
- **最大內容繪製** (LCP): <3 秒
- **累積佈局偏移** (CLS): <0.1
- **首次輸入延遲** (FID): <100 毫秒

### 效能優化建議
1. 定期清理舊的對話資料
2. 關閉不需要的除錯面板
3. 使用現代瀏覽器的最新版本
4. 確保穩定的網路連接

## 🔒 安全性考量

### 資料安全
- API Key 僅在客戶端儲存，不會傳送到第三方服務
- 對話資料存儲在本地 IndexedDB 中
- 支援清除所有本地資料的功能

### 隱私保護
- 音頻和視頻資料不會被本地儲存
- 可隨時中斷與 Live API 的連接
- 提供完整的資料匯出和刪除功能

## 🤝 貢獻指南

我們歡迎社區貢獻！請遵循以下步驟：

1. **Fork 專案** 到你的 GitHub 帳戶
2. **創建功能分支**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **提交更改**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **推送到分支**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **開啟 Pull Request**

### 貢獻類型
- 🐛 Bug 修復
- ✨ 新功能開發
- 📚 文檔改善
- 🎨 UI/UX 改進
- ⚡ 效能優化
- 🧪 測試增強

### 程式碼風格
- 使用 TypeScript 嚴格模式
- 遵循 ESLint 和 Prettier 配置
- 撰寫有意義的提交訊息
- 包含適當的測試覆蓋

## 📄 授權條款

本專案採用 **Apache License 2.0** 開源授權。

## 📞 支援與社群

### 獲取幫助
- 📋 **問題回報**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **功能請求**: [GitHub Discussions](https://github.com/your-repo/discussions)
- 📧 **技術支援**: support@example.com

### 社群資源
- 🌟 給我們一個 Star 如果這個專案對你有幫助
- 🐦 關注我們的更新: [@YourProject](https://twitter.com/yourproject)
- 📖 查看更多文檔: [Project Wiki](https://github.com/your-repo/wiki)

---

## 🎯 發展路線圖

### 即將推出
- [ ] 支援更多檔案格式
- [ ] 進階音頻處理功能
- [ ] 多語言介面支援
- [ ] 主題自定義工具

### 長期計劃
- [ ] 雲端同步功能
- [ ] 團隊協作支援
- [ ] 插件系統
- [ ] API 整合平台

**Happy Coding! 🚀**

*最後更新: 2025-08-12*