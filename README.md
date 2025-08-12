# Google Gemini Live API 對話測試平台

一個專業的多模態 AI 對話平台，基於 Google Gemini Live API 構建。採用現代化 React 架構，支援即時語音對話、智能聊天室管理、自動 session resumption 和高級音頻視覺化功能。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
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
- **智能切換**: 自動等待 session handle，確保無縫對話切換
- **持久化儲存**: IndexedDB 儲存，optimistic updates 提升響應速度
- **Session Resumption**: 15分鐘內自動恢復中斷的對話 session

### 🎙️ 高級轉錄功能
- **即時轉錄**: 語音轉文字的即時顯示
- **轉錄編輯**: 可編輯轉錄文字後再發送
- **多語言支援**: 支援繁體中文、英文等多種語言
- **音頻視覺化**: 豐富的音頻波形和脈衝視覺效果

### 🎨 專業使用者介面
- **雙欄佈局**: 左側聊天室列表、右側主要對話區域，簡潔高效
- **響應式設計**: 完美適配桌面、平板和手機裝置
- **收合面板**: 可隱藏側邊欄以獲得更大的對話空間
- **深色主題**: 護眼的深色界面設計，適合長時間使用

### 🔧 開發者工具
- **Session 除錯**: 完整的 session resumption 追蹤和診斷
- **智能 Hook 系統**: 9 個精心設計的 hooks 處理複雜業務邏輯
- **統一訊息工廠**: 避免重複程式碼，確保資料一致性
- **除錯模式**: 開發環境自動啟用詳細日誌和工具

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
│   │   └── TwoColumnLayout.tsx     # 雙欄佈局組件
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
│       └── CollapsiblePanel.tsx
├── hooks/                    # 自定義 React Hooks (9 個核心 hooks)
│   ├── use-live-api.ts      # Live API 整合
│   ├── use-chat-manager.ts  # 聊天管理 (智能切換)
│   ├── use-transcription.ts # 轉錄功能 (支援 Live API 整合)
│   ├── use-session-resumption.ts # Session 恢復 (15分鐘過期)
│   ├── use-conversation.ts  # 對話操作 (文字/語音/媒體)
│   ├── use-conversation-events.ts # Live API 事件處理
│   └── use-transcription-integration.ts # 轉錄整合 (向後相容)
├── stores/                  # Zustand 狀態管理
│   ├── chat-store-persistent.ts # 持久化聊天狀態 (optimistic updates)
│   └── ui-store.ts          # UI 狀態 (雙欄佈局控制)
├── contexts/               # React Context
│   └── LiveAPIContext.tsx  # Live API 上下文
├── lib/                   # 核心函式庫
│   ├── indexeddb/         # 數據庫操作
│   ├── worklets/          # Audio Worklets
│   ├── audio-recorder.ts  # 音頻錄製
│   └── genai-live-client.ts # Gemini 客戶端
├── types/                 # TypeScript 類型定義
│   ├── chat.ts            # 聊天室和訊息類型
│   └── transcription.ts   # 轉錄相關類型
├── utils/                 # 工具函數
│   ├── message-factory.ts # 統一訊息建立工廠
│   └── session-debug.ts   # Session 除錯工具
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
- 完整雙欄佈局顯示，簡潔高效
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

*最後更新: 2025-08-12 | 版本: v0.1.2*

---

## 📜 更新日誌

### v0.1.2 (2025-08-12)
**Hook 系統重構和架構優化**

#### 🎆 新增功能
- ✨ 新增 `message-factory.ts` 統一訊息建立工廠
- ✨ 新增 `session-debug.ts` 精簡的 session 除錯工具
- ✨ 新增 `use-transcription-integration.ts` 向後相容 hook

#### 🔄 重構和改進
- ⚡ **智能切換**: `use-chat-manager.ts` 新增 5秒等待機制
- ⚡ **Hook 整合**: `useTranscription` 支援 Live API 整合選項
- ⚡ **Session 管理**: 15分鐘過期機制，符合官方規範
- 🚀 **統一工廠**: 消除重複的 `createMessage` 函式

#### 🧹 清理和移除
- 🗑️ 移除 `use-ai-audio-status.ts` (完全未使用)
- 🗑️ 移除 `ThreeColumnLayout.tsx` (未使用)
- 🗑️ 清理 `session-resumption-demo.tsx`
- 🗑️ 清理整合多個 session debug 檔案

#### 📚 文檔更新
- 📝 更新 CLAUDE.md 和 README.md 反映現有架構
- 📝 更新所有組件說明和使用方式
- 📝 新增完整的 hooks 架構說明

### v0.1.1 (2025-08-11)
- ✨ 新增雙欄佈局系統
- ✨ 新增多種音頻視覺化效果
- ✨ 新增 debug 組件和測試工具

### v0.1.0 (2025-01-08)
- ✨ 初始版本：完整的 Google Gemini Live API 整合
- ✨ 多聊天室管理系統
- ✨ IndexedDB 數據持久化
- ✨ Session resumption 功能

---

## 🎯 發展路線圖

### v0.1.3 即將推出
- [ ] 完整的測試套件 (Jest + RTL)
- [ ] 性能監控和優化工具
- [ ] 更多音頻視覺化效果
- [ ] 支援更多檔案格式上傳

### v0.2.0 長期計劃
- [ ] 多語言介面支援 (i18n)
- [ ] 主題系統和自定義工具
- [ ] PWA 支援和離線模式
- [ ] 更多 AI 模型整合 (Claude, GPT)

### 未來願景
- [ ] 雲端同步和協作功能
- [ ] 插件系統和第三方整合
- [ ] 企業版功能 (用戶管理, 權限控制)
- [ ] 智能分析和洞察儀表板