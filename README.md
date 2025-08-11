# 對話測試平台

基於 Google Gemini Live API 的專業對話測試平台，支援多聊天室管理、即時語音轉錄和多模態 AI 互動。

## ✨ 功能特色

### 🗣️ 多模態互動
- **語音對話**: 即時語音輸入與 AI 語音回應
- **視頻支援**: 攝影機視頻流整合
- **螢幕分享**: 分享螢幕內容給 AI 分析
- **檔案上傳**: 支援多種檔案格式

### 💬 聊天室管理
- **多聊天室**: 創建和管理多個獨立對話
- **聊天室切換**: 快速切換不同對話，保持狀態
- **重命名與刪除**: 自定義聊天室名稱
- **對話歷史**: 完整保存對話記錄

### 🎙️ 即時轉錄
- **語音轉文字**: 即時轉錄語音輸入
- **轉錄編輯**: 可編輯轉錄文字後發送
- **多語言支援**: 支援繁體中文等多種語言

### 🎨 使用者介面
- **三欄佈局**: 左側聊天室列表、中間對話區、右側除錯面板
- **響應式設計**: 自適應桌面、平板和手機
- **面板收合**: 可收合側邊欄節省空間
- **深色主題**: 護眼的深色界面設計

### 🔧 除錯工具
- **即時日誌**: 查看系統運行日誌
- **工具呼叫**: 監控 AI 工具使用情況
- **篩選搜索**: 快速定位問題

## 🚀 快速開始

### 前置需求
- Node.js 16.x 或更高版本
- npm 或 yarn
- Google Gemini API Key

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone <repository-url>
   cd conversation-testing-platform
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **配置環境變數**
   ```bash
   cp .env.example .env
   ```
   
   編輯 `.env` 檔案，添加你的 Gemini API Key：
   ```
   REACT_APP_GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **啟動開發服務器**
   ```bash
   npm start
   ```

5. **開啟瀏覽器**
   
   瀏覽器會自動開啟 `http://localhost:3000`

### 獲取 API Key

1. 前往 [Google AI Studio](https://ai.google.dev/)
2. 創建新專案或選擇現有專案
3. 生成 API Key
4. 將 API Key 添加到 `.env` 檔案中

## 📋 使用指南

### 基本操作

1. **連接 API**: 啟動後點擊頂部的「未連接」按鈕連接 Gemini Live API
2. **創建聊天室**: 點擊左側「新對話」按鈕
3. **切換聊天室**: 點擊左側聊天室列表中的項目
4. **文字對話**: 在底部輸入框中輸入文字，按 Enter 鍵發送
5. **語音輸入**: 點擊麥克風圖標開始錄音（需要 API 連接）
6. **發送訊息**: 按 Enter 鍵或點擊發送按鈕

### 高級功能

- **攝影機**: 點擊攝影機圖標啟用視頻流
- **螢幕分享**: 點擊螢幕圖標分享螢幕
- **檔案上傳**: 點擊檔案夾圖標上傳檔案
- **面板控制**: 點擊面板邊緣的箭頭收合/展開

## 🏗️ 專案架構

```
src/
├── components/
│   ├── layout/              # 佈局組件
│   ├── chat-manager/        # 聊天室管理
│   ├── conversation/        # 對話顯示
│   ├── input-area/          # 輸入區域
│   ├── debug-panel/         # 除錯面板
│   └── shared/              # 共用組件
├── hooks/                   # React Hooks
├── stores/                  # 狀態管理 (Zustand)
├── types/                   # TypeScript 類型
├── styles/                  # 樣式變數
├── contexts/                # React Context
├── lib/                     # 核心庫
└── utils/                   # 工具函數
```

## 🛠️ 開發指令

```bash
# 啟動開發服務器
npm start

# 構建生產版本
npm run build

# 運行測試
npm test

# 型別檢查
npx tsc --noEmit

# 啟動 HTTPS 開發服務器 (某些 API 需要)
npm run start-https
```

## 📱 響應式設計

- **桌面版** (>1024px): 完整三欄佈局
- **平板版** (768px-1024px): 左側面板自動收合
- **手機版** (<768px): 全螢幕對話，側邊欄變為抽屜

## 🎨 自定義主題

專案使用 CSS 變數系統，可輕鬆自定義主題顏色：

```scss
:root {
  --bg-primary: #0a0a0a;        // 主背景色
  --bg-secondary: #1a1a1a;      // 次背景色
  --text-primary: #ffffff;      // 主文字色
  --accent-color: #4285f4;      // 強調色
  // ... 更多變數
}
```

## 🔧 故障排除

### 常見問題

1. **API Key 錯誤**
   - 確認 API Key 正確設置在 `.env` 檔案中
   - 檢查 API Key 是否有效且有足夠權限

2. **麥克風無法使用**
   - 確認瀏覽器已允許麥克風權限
   - 使用 HTTPS 連接 (某些瀏覽器要求)

3. **樣式顯示異常**
   - 清除瀏覽器快取
   - 確認所有 SCSS 檔案正確載入

### 支援的瀏覽器

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📄 授權

本專案基於 Apache 2.0 授權條款開源。

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 本專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📞 支援

如有問題或建議，請：
- 提交 [GitHub Issue](issues)
- 發送郵件至 support@example.com

---

**Happy Coding! 🚀**