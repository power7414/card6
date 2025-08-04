# Google Live API 語音對話平台開發指南

## 專案概述
這是一個基於 Google Live API 的語音對話測試平台，支援文字輸入、語音輸入（按鈕式和連續對話）、即時轉錄、Thread 管理和語音設定調整。

## 技術架構
- **前端**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **後端**: Node.js + Express + Socket.io (WebSocket)
- **資料庫**: SQLite (開發環境)
- **主要 API**: Google Live API (Gemini 2.0 Flash)

## 專案結構
```
card6/
├── frontend/               # React 前端應用
│   ├── src/
│   │   ├── components/    # UI 元件
│   │   ├── hooks/        # 自定義 Hooks
│   │   ├── services/     # API 服務
│   │   ├── stores/       # Zustand 狀態管理
│   │   └── utils/        # 工具函數
│   └── package.json
├── backend/               # Node.js 後端服務
│   ├── src/
│   │   ├── api/          # REST API 路由
│   │   ├── websocket/    # WebSocket 處理
│   │   ├── services/     # 業務邏輯
│   │   └── db/           # 資料庫模型
│   └── package.json
├── shared/                # 共享類型定義
└── docker-compose.yml     # 本地開發環境
```

## 核心功能實作要點

### 1. Google Live API 連接
- 使用 WebSocket 建立持久連接
- 音頻格式：輸入 16kHz 16-bit PCM，輸出 24kHz 16-bit PCM
- 支援雙向即時音頻流
- 處理連接中斷和重連

### 2. 三種輸入模式
- **文字輸入**: 直接發送文字到 API
- **Push-to-Talk**: 按住錄音，放開發送
- **連續對話**: 持續監聽，自動 VAD 檢測

### 3. Thread 管理
- 每個對話建立唯一 Thread ID
- 支援對話歷史載入
- 上下文管理（最近 N 條消息）

### 4. 語音設定
- 語速: 0.5x - 2.0x
- 音量: 0 - 100
- 語音選擇: 依據 API 提供的選項

## 開發流程

### 環境準備
1. 取得 Google Live API 金鑰
2. 安裝 Node.js 18+ 和 pnpm
3. 設定環境變數 (.env)

### 指令
```bash
# 安裝依賴
pnpm install

# 啟動開發環境
pnpm dev

# 執行測試
pnpm test

# 建置生產版本
pnpm build

# 程式碼檢查
pnpm lint
pnpm typecheck
```

## 重要注意事項

### API 使用
- Google Live API 需要申請存取權限
- 注意 API 使用限制和費用
- 開發時使用 localhost，生產環境需要 HTTPS

### 音頻處理
- 確保瀏覽器麥克風權限
- 處理不同瀏覽器的音頻 API 差異
- 實作音頻緩衝以確保流暢播放

### 錯誤處理
- WebSocket 斷線重連機制
- API 錯誤的優雅降級
- 用戶友好的錯誤提示

### 效能優化
- 音頻資料使用 ArrayBuffer 傳輸
- 實作訊息節流避免過載
- 使用 Web Workers 處理音頻

## 測試重點
1. 不同網路環境下的連接穩定性
2. 長時間對話的記憶體管理
3. 多 Thread 切換的狀態保持
4. 音頻品質和延遲測試

## 部署考量
- 本 MVP 版本僅供本地開發測試
- 生產環境需要考慮：
  - HTTPS 配置
  - WebSocket 代理設定
  - 資料庫遷移到 PostgreSQL
  - 負載平衡和擴展性

## 疑難排解
- 麥克風無法使用：檢查瀏覽器權限設定
- WebSocket 連接失敗：確認防火牆和代理設定
- 音頻播放問題：檢查瀏覽器自動播放政策
- API 錯誤：確認金鑰有效性和配額

## 相關資源
- [Google Live API 文件](https://ai.google.dev/gemini-api/docs/live)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Socket.io 文件](https://socket.io/docs/v4/)