# Session management with Live API

在 Live API 中，工作階段是指持續連線，輸入和輸出內容會透過同一連線持續串流 (進一步瞭解運作方式)。這種獨特的工作階段設計可實現低延遲，並支援獨特功能，但也會帶來一些挑戰，例如工作階段時間限制和提早終止。本指南涵蓋相關策略，可協助您克服使用 Live API 時可能發生的工作階段管理問題。

## 工作階段生命週期

如果沒有壓縮，純音訊工作階段的長度上限為 **15 分鐘**，音訊/視訊工作階段的長度上限則為 **2 分鐘**。如果超過這些限制，工作階段 (以及連線) 就會終止，但您可以使用內容視窗壓縮功能，將工作階段延長至無限時間。

連線的生命週期也有所限制，大約為 **10 分鐘**。連線終止時，工作階段也會終止。在這種情況下，您可以設定單一工作階段，透過工作階段續傳在多個連線中保持有效。連線結束前，您也會收到 `GoAway` 訊息，可採取進一步行動。

## 脈絡窗口壓縮

如要延長工作階段時間，避免連線突然終止，您可以啟用內容視窗壓縮功能，方法是在工作階段設定中將 `contextWindowCompression` 欄位設為 `true`。

在 `ContextWindowCompressionConfig` 中，您可以設定滑動視窗機制和觸發壓縮的權杖數量。

**JavaScript**
```javascript
const config = {
  responseModalities: [Modality.AUDIO],
  contextWindowCompression: { slidingWindow: {} }
};
```

## 繼續工作階段

如要防止伺服器定期重設 WebSocket 連線時終止工作階段，請在設定設定中設定 `sessionResumption` 欄位。

傳遞這項設定會導致伺服器傳送 `SessionResumptionUpdate` 訊息，可用於傳遞最後一個恢復權杖做為後續連線的 `SessionResumptionConfig.handle`，以恢復工作階段。

**JavaScript**
```javascript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({});
const model = 'gemini-live-2.5-flash-preview';

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

console.debug('Connecting to the service with handle %s...', previousSessionHandle)
const session = await ai.live.connect({
  model: model,
  callbacks: {
    onopen: function () {
      console.debug('Opened');
    },
    onmessage: function (message) {
      responseQueue.push(message);
    },
    onerror: function (e) {
      console.debug('Error:', e.message);
    },
    onclose: function (e) {
      console.debug('Close:', e.reason);
    },
  },
  config: {
    responseModalities: [Modality.TEXT],
    sessionResumption: { handle: previousSessionHandle }
    // The handle of the session to resume is passed here, or else null to start a new session.
  }
});

const inputTurns = 'Hello how are you?';
session.sendClientContent({ turns: inputTurns });

const turns = await handleTurn();
for (const turn of turns) {
  if (turn.sessionResumptionUpdate) {
    if (turn.sessionResumptionUpdate.resumable && turn.sessionResumptionUpdate.newHandle) {
      let newHandle = turn.sessionResumptionUpdate.newHandle
      // ...Store newHandle and start new session with this handle here
    }
  }
}

  session.close();
}

async function main() {
  await live().catch((e) => console.error('got error', e));
}

main();
```

## 在工作階段中斷前收到訊息

伺服器會傳送 `GoAway` 訊息，表示目前的連線即將終止。這則訊息包含 `timeLeft`，指出剩餘時間，並讓您在連線因 `ABORTED` 而終止前採取進一步行動。

**JavaScript**
```javascript
const turns = await handleTurn();

for (const turn of turns) {
  if (turn.goAway) {
    console.debug('Time left: %s\n', turn.goAway.timeLeft);
  }
}
```

## 生成完成時收到訊息

伺服器會傳送 `generationComplete` 訊息，表示模型已完成生成回覆。

**JavaScript**
```javascript
const turns = await handleTurn();

for (const turn of turns) {
  if (turn.serverContent && turn.serverContent.generationComplete) {
    // The generation is complete
  }
}
```

## 後續步驟

如要進一步瞭解如何使用 Live API，請參閱完整功能指南、工具使用頁面或 Live API 食譜。