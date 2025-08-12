# Google Live API setupComplete 事件未觸發 - 根本原因分析

## 🎯 **問題摘要**

經過深入分析，發現 `setupComplete` 事件從未觸發的根本原因是 **session resumption 配置錯誤**，具體表現為：

1. 使用 `{handle: undefined}` 而非 `{handle: null}`
2. 事件監聽器註冊時機問題
3. Session handle 檢索的競態條件

## 🔍 **詳細分析**

### 問題 1: sessionResumption 配置錯誤 (關鍵問題)

**位置**: `src/lib/genai-live-client.ts:257`

**當前代碼**:
```typescript
sessionResumption: { handle: sessionHandle || undefined }
```

**問題分析**:
- 當 `sessionHandle` 為 `null` 時，`sessionHandle || undefined` 返回 `undefined`
- Google Live API 期望新 session 使用 `null`，而非 `undefined`
- `undefined` 可能被 API 視為配置錯誤，導致拒絕建立連接

**影響**: 這是導致 setup 失敗的主要原因，API 在配置驗證階段就失敗了

### 問題 2: 事件監聽器註冊時機

**位置**: `src/lib/genai-live-client.ts:313`

**當前邏輯**:
```typescript
this.once("setupcomplete", onSetupComplete);
```

**問題分析**:
- 事件監聽器在連接過程中註冊，可能錯過早期事件
- 應該在連接前就註冊所有必要的事件監聽器

### 問題 3: Session Handle 檢索競態條件

**位置**: `src/hooks/use-live-api.ts:348`

**當前邏輯**:
```typescript
const sessionHandle = sessionResumptionRef.current.getSessionHandle(chatRoomId);
```

**問題分析**:
- 在 `setCurrentChatRoomId(chatRoomId)` 之後立即檢索
- 可能存在狀態同步延遲，導致檢索到過時的 session handle

## 🛠️ **修復方案**

### 修復 1: 正確的 sessionResumption 配置

```typescript
// 修改前
sessionResumption: { handle: sessionHandle || undefined }

// 修改後
sessionResumption: { handle: sessionHandle }
```

**說明**: 直接使用 `sessionHandle`（可能為 `null`），不要用 `|| undefined`

### 修復 2: 提前註冊事件監聽器

```typescript
// 在 connect 方法開始時就註冊
const setupCompletePromise = new Promise<void>((resolve) => {
  this.once("setupcomplete", () => {
    this._setupComplete = true;
    resolve();
  });
});
```

### 修復 3: 改善 Session Handle 檢索時機

```typescript
// 等待狀態同步後再檢索
await new Promise(resolve => setTimeout(resolve, 100));
const sessionHandle = sessionResumptionRef.current.getSessionHandle(chatRoomId);
```

## 🔧 **驗證方法**

使用提供的診斷工具驗證修復效果：

```typescript
import { enableLiveAPIDiagnostics, instrumentLiveClientForDiagnostics } from './utils/live-api-diagnostics';

// 啟用診斷
enableLiveAPIDiagnostics();

// 在 useLiveAPI hook 中
const connectionId = instrumentLiveClientForDiagnostics(client);
```

## 📊 **預期結果**

修復後應該看到：
1. `setupComplete` 事件正常觸發
2. 診斷報告顯示 "Setup完成: ✅"
3. 連接超時問題解決

## 🎯 **優先級**

**立即修復**: 修復 1 (sessionResumption 配置)
**重要**: 修復 2 (事件監聽器時機)
**建議**: 修復 3 (檢索時機優化)

修復 1 是解決問題的關鍵，應該優先實施。