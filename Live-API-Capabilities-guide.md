# Live API capabilities guide

> **預覽版：** Live API 目前為預覽版。

這份完整指南涵蓋 Live API 提供的功能和設定。如需常見用途的總覽和程式碼範例，請參閱「開始使用 Live API」頁面。

## 事前準備

- **熟悉核心概念：** 如果您還沒這麼做，請先閱讀「開始使用 Live API」頁面。本文將介紹 Live API 的基本原則、運作方式，以及不同模型之間的差異，以及對應的音訊生成方法 (原生音訊或半級聯)。
- **在 AI Studio 中試用 Live API：** 建議您先在 Google AI Studio 中試用 Live API，再開始建構應用程式。如要在 Google AI Studio 中使用 Live API，請選取「串流」。

## 建立連線

以下範例說明如何使用 API 金鑰建立連線：

**Python**
```python
import asyncio
from google import genai

client = genai.Client()

model = "gemini-live-2.5-flash-preview"
config = {"response_modalities": ["TEXT"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        print("Session started")

if __name__ == "__main__":
    asyncio.run(main())
```

> **注意：** 您只能在 `response_modalities` 欄位中設定一種模式。也就是說，你可以設定模型以文字或語音回覆，但無法在同一個工作階段中同時使用這兩種方式。

## 互動模式

以下各節提供範例和相關背景資訊，說明 Live API 支援的各種輸入和輸出模式。

### 收發簡訊

以下說明如何傳送及接收訊息：

**Python**
```python
import asyncio
from google import genai

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {"response_modalities": ["TEXT"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        message = "Hello, how are you?"
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": message}]}, turn_complete=True
        )

        async for response in session.receive():
            if response.text is not None:
                print(response.text, end="")

if __name__ == "__main__":
    asyncio.run(main())
```

### 分批更新內容

使用增量更新傳送文字輸入內容、建立工作階段情境或還原工作階段情境。如為簡短情境，您可以傳送逐輪互動，代表事件的確切順序：

**Python**
```python
turns = [
    {"role": "user", "parts": [{"text": "What is the capital of France?"}]},
    {"role": "model", "parts": [{"text": "Paris"}]},
]

await session.send_client_content(turns=turns, turn_complete=False)

turns = [{"role": "user", "parts": [{"text": "What is the capital of Germany?"}]}]

await session.send_client_content(turns=turns, turn_complete=True)
```

如果脈絡較長，建議提供單一訊息摘要，以便在後續互動中釋放脈絡窗口。如要瞭解載入工作階段內容的其他方法，請參閱「繼續工作階段」。

### 傳送及接收音訊

最常見的音訊範例是音訊轉音訊，請參閱入門指南。

以下是**語音轉文字範例**，可讀取 WAV 檔案、以正確格式傳送，並接收文字輸出內容：

**Python**
```python
# Test file: https://storage.googleapis.com/generativeai-downloads/data/16000.wav
# Install helpers for converting files: pip install librosa soundfile
import asyncio
import io
from pathlib import Path
from google import genai
from google.genai import types
import soundfile as sf
import librosa

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {"response_modalities": ["TEXT"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:

        buffer = io.BytesIO()
        y, sr = librosa.load("sample.wav", sr=16000)
        sf.write(buffer, y, sr, format='RAW', subtype='PCM_16')
        buffer.seek(0)
        audio_bytes = buffer.read()

        # If already in correct format, you can use this:
        # audio_bytes = Path("sample.pcm").read_bytes()

        await session.send_realtime_input(
            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
        )

        async for response in session.receive():
            if response.text is not None:
                print(response.text)

if __name__ == "__main__":
    asyncio.run(main())
```

以下是**文字轉語音的範例**。如要接收音訊，請將 `AUDIO` 設為回應模式。這個範例會將收到的資料儲存為 WAV 檔案：

**Python**
```python
import asyncio
import wave
from google import genai

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {"response_modalities": ["AUDIO"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        wf = wave.open("audio.wav", "wb")
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)

        message = "Hello how are you?"
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": message}]}, turn_complete=True
        )

        async for response in session.receive():
            if response.data is not None:
                wf.writeframes(response.data)

            # Un-comment this code to print audio data info
            # if response.server_content.model_turn is not None:
            #      print(response.server_content.model_turn.parts[0].inline_data.mime_type)

        wf.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### 音訊格式

Live API 中的音訊資料一律為原始的小端序 16 位元 PCM。音訊輸出內容一律會使用 24kHz 的取樣率。輸入音訊的原始取樣率為 16 kHz，但 Live API 會視需要重新取樣，因此可以傳送任何取樣率。如要傳達輸入音訊的取樣率，請將每個含有音訊的 Blob 的 MIME 類型設為 `audio/pcm;rate=16000` 等值。

### 音訊轉錄

如要啟用模型音訊輸出的轉錄功能，請在設定設定中傳送 `output_audio_transcription`。系統會根據模型的回覆推斷轉錄語言。

**Python**
```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {"response_modalities": ["AUDIO"],
        "output_audio_transcription": {}
}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        message = "Hello? Gemini are you there?"

        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": message}]}, turn_complete=True
        )

        async for response in session.receive():
            if response.server_content.model_turn:
                print("Model turn:", response.server_content.model_turn)
            if response.server_content.output_transcription:
                print("Transcript:", response.server_content.output_transcription.text)

if __name__ == "__main__":
    asyncio.run(main())
```

您可以在設定檔中傳送 `input_audio_transcription`，啟用音訊輸入的轉錄功能。

**Python**
```python
import asyncio
from pathlib import Path
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {
    "response_modalities": ["TEXT"],
    "input_audio_transcription": {},
}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        audio_data = Path("16000.pcm").read_bytes()

        await session.send_realtime_input(
            audio=types.Blob(data=audio_data, mime_type='audio/pcm;rate=16000')
        )

        async for msg in session.receive():
            if msg.server_content.input_transcription:
                print('Transcript:', msg.server_content.input_transcription.text)

if __name__ == "__main__":
    asyncio.run(main())
```

### 串流播放音訊和影片

如要查看如何以串流音訊和影片格式使用 Live API 的範例，請在食譜存放區中執行「Live API - Get Started」檔案：

[在 Colab 中查看](https://colab.research.google.com/)

## 變更語音和語言

Live API 模型支援的語音各不相同。半連鎖支援 Puck、Charon、Kore、Fenrir、Aoede、Leda、Orus 和 Zephyr。原生音訊支援的語言清單較長 (與 TTS 模型清單相同)。你可以在 AI Studio 中聆聽所有聲音。

如要指定語音，請在 `speechConfig` 物件中設定語音名稱，做為工作階段設定的一部分：

**Python**
```python
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "voice_config": {"prebuilt_voice_config": {"voice_name": "Kore"}}
    },
}
```

> **注意：** 如果您使用 generateContent API，可用的語音會略有不同。如需 generateContent 音訊生成語音，請參閱音訊生成指南。

Live API 支援多種語言。

如要變更語言，請在 `speechConfig` 物件中設定語言代碼，做為工作階段設定的一部分：

**Python**
```python
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "language_code": "de-DE"
    }
}
```

> **注意：** 原生音訊輸出模型會自動選擇適當的語言，且不支援明確設定語言代碼。

## 內建音訊功能

下列功能僅適用於原生音訊。如要進一步瞭解原生音訊，請參閱「選擇模型並生成音訊」。

> **注意：** 原生音訊模型目前僅支援使用部分工具。詳情請參閱「支援的工具總覽」。

### 如何使用原生音訊輸出

如要使用原生音訊輸出，請設定其中一個原生音訊模型，並將 `response_modalities` 設為 `AUDIO`。

如需完整範例，請參閱「傳送及接收音訊」。

**Python**
```python
model = "gemini-2.5-flash-preview-native-audio-dialog"
config = types.LiveConnectConfig(response_modalities=["AUDIO"])

async with client.aio.live.connect(model=model, config=config) as session:
    # Send audio input and receive audio
```

### 情緒感知對話

這項功能可讓 Gemini 根據輸入內容的措辭和語氣調整回覆風格。

如要使用情感對話，請將 API 版本設為 `v1alpha`，並在設定訊息中將 `enable_affective_dialog` 設為 `true`：

**Python**
```python
client = genai.Client(http_options={"api_version": "v1alpha"})

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    enable_affective_dialog=True
)
```

請注意，目前只有原生音訊輸出模型支援情感對話。

### 主動音訊

啟用這項功能後，如果內容不相關，Gemini 可能會主動決定不回覆。

如要使用這項功能，請將 API 版本設為 `v1alpha`，並在設定訊息中設定 `proactivity` 欄位，然後將 `proactive_audio` 設為 `true`：

**Python**
```python
client = genai.Client(http_options={"api_version": "v1alpha"})

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    proactivity={'proactive_audio': True}
)
```

請注意，主動式音訊目前僅支援原生音訊輸出模型。

### 內建語音輸出功能 (含思考過程)

原生音訊輸出支援思考能力，可透過獨立模型 `gemini-2.5-flash-exp-native-audio-thinking-dialog` 使用。

如需完整範例，請參閱「傳送及接收音訊」。

**Python**
```python
model = "gemini-2.5-flash-exp-native-audio-thinking-dialog"
config = types.LiveConnectConfig(response_modalities=["AUDIO"])

async with client.aio.live.connect(model=model, config=config) as session:
    # Send audio input and receive audio
```

## 語音活動偵測 (VAD)

語音活動偵測 (VAD) 可讓模型辨識使用者何時說話。這對建立自然對話至關重要，因為使用者可以隨時中斷模型。

VAD 偵測到中斷時，系統會取消並捨棄正在進行的生成作業。工作階段記錄只會保留已傳送給用戶端的資訊。接著，伺服器會傳送 `BidiGenerateContentServerContent` 訊息，回報中斷情形。

接著，Gemini 伺服器會捨棄所有待處理的函式呼叫，並傳送含有已取消呼叫 ID 的 `BidiGenerateContentServerContent` 訊息。

**Python**
```python
async for response in session.receive():
    if response.server_content.interrupted is True:
        # The generation was interrupted

        # If realtime playback is implemented in your application,
        # you should stop playing audio and clear queued playback here.
```

### 自動 VAD

根據預設，模型會對連續音訊輸入串流自動執行 VAD。您可以使用設定配置的 `realtimeInputConfig.automaticActivityDetection` 欄位設定 VAD。

如果音訊串流暫停超過一秒 (例如使用者關閉麥克風)，就應傳送 `audioStreamEnd` 事件，清除所有快取音訊。用戶端隨時可以繼續傳送音訊資料。

**Python**
```python
# example audio file to try:
# URL = "https://storage.googleapis.com/generativeai-downloads/data/hello_are_you_there.pcm"
# !wget -q $URL -O sample.pcm
import asyncio
from pathlib import Path
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

config = {"response_modalities": ["TEXT"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        audio_bytes = Path("sample.pcm").read_bytes()

        await session.send_realtime_input(
            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
        )

        # if stream gets paused, send:
        # await session.send_realtime_input(audio_stream_end=True)

        async for response in session.receive():
            if response.text is not None:
                print(response.text)

if __name__ == "__main__":
    asyncio.run(main())
```

使用 `send_realtime_input` 時，API 會根據 VAD 自動回應音訊。`send_client_content` 會依序將訊息新增至模型內容，而 `send_realtime_input` 則會犧牲確定性排序，以提升回應速度。

### 自動 VAD 設定

如要進一步控管 VAD 活動，可以設定下列參數。詳情請參閱 API 參考資料。

**Python**
```python
from google.genai import types

config = {
    "response_modalities": ["TEXT"],
    "realtime_input_config": {
        "automatic_activity_detection": {
            "disabled": False, # default
            "start_of_speech_sensitivity": types.StartSensitivity.START_SENSITIVITY_LOW,
            "end_of_speech_sensitivity": types.EndSensitivity.END_SENSITIVITY_LOW,
            "prefix_padding_ms": 20,
            "silence_duration_ms": 100,
        }
    }
}
```

### 停用自動 VAD

或者，您也可以在設定訊息中將 `realtimeInputConfig.automaticActivityDetection.disabled` 設為 `true`，停用自動 VAD。在此設定中，用戶端負責偵測使用者語音，並在適當時間傳送 `activityStart` 和 `activityEnd` 訊息。這個設定未傳送 `audioStreamEnd`。而是以 `activityEnd` 訊息標示串流中斷。

**Python**
```python
config = {
    "response_modalities": ["TEXT"],
    "realtime_input_config": {"automatic_activity_detection": {"disabled": True}},
}

async with client.aio.live.connect(model=model, config=config) as session:
    # ...
    await session.send_realtime_input(activity_start=types.ActivityStart())
    await session.send_realtime_input(
        audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
    )
    await session.send_realtime_input(activity_end=types.ActivityEnd())
    # ...
```

## 權杖數量

您可以在傳回伺服器訊息的 `usageMetadata` 欄位中，查看已使用的權杖總數。

**Python**
```python
async for message in session.receive():
    # The server will periodically send messages that include UsageMetadata.
    if message.usage_metadata:
        usage = message.usage_metadata
        print(
            f"Used {usage.total_token_count} tokens in total. Response token breakdown:"
        )
        for detail in usage.response_tokens_details:
            match detail:
                case types.ModalityTokenCount(modality=modality, token_count=count):
                    print(f"{modality}: {count}")
```

## 媒體解析度

您可以設定工作階段設定中的 `mediaResolution` 欄位，指定輸入媒體的媒體解析度：

**Python**
```python
from google.genai import types

config = {
    "response_modalities": ["AUDIO"],
    "media_resolution": types.MediaResolution.MEDIA_RESOLUTION_LOW,
}
```

## 限制

規劃專案時，請注意 Live API 的下列限制。

### 回覆方式

在工作階段設定中，每個工作階段只能設定一種回應模式 (`TEXT` 或 `AUDIO`)。如果同時設定這兩項，系統會顯示設定錯誤訊息。也就是說，您可以將模型設定為以文字或音訊回覆，但無法在同一工作階段中同時使用這兩種方式。

### 用戶端驗證

Live API 預設只提供伺服器對伺服器驗證。如果您使用用戶端對伺服器方法實作 Live API 應用程式，則必須使用暫時性權杖來降低安全風險。

### 工作階段持續時間

- 僅限音訊的課程最多 15 分鐘
- 音訊加視訊的課程最多 2 分鐘

不過，您可以設定不同的工作階段管理技術，無限延長工作階段時間。

### 脈絡窗口

工作階段的脈絡窗口限制如下：

- 原生音訊輸出模型為 128,000 個符記
- 其他 Live API 模型支援 3.2 萬個權杖

## 支援的語言

Live API 支援下列語言。

> **注意：** 原生音訊輸出模型會自動選擇適當的語言，且不支援明確設定語言代碼。

| 語言 | BCP-47 代碼 | 語言 | BCP-47 代碼 |
|------|-------------|------|-------------|
| 德文 (德國) | de-DE | 英文 (澳洲)* | en-AU |
| 英文 (英國)* | en-GB | 英文 (印度) | en-IN |
| 英文 (美國) | en-US | 西班牙文 (美國) | es-US |
| 法文 (法國) | fr-FR | 北印度文 (印度) | hi-IN |
| 葡萄牙文 (巴西) | pt-BR | 阿拉伯文 (一般) | ar-XA |
| 西班牙文 (西班牙)* | es-ES | 法文 (加拿大)* | fr-CA |
| 印尼文 (印尼) | id-ID | 義大利文 (義大利) | it-IT |
| 日文 (日本) | ja-JP | 土耳其文 (土耳其) | tr-TR |
| 越南文 (越南) | vi-VN | 孟加拉文 (印度) | bn-IN |
| 古吉拉特文 (印度)* | gu-IN | 卡納達文 (印度)* | kn-IN |
| 馬拉地文 (印度) | mr-IN | 馬拉雅拉姆文 (印度)* | ml-IN |
| 泰米爾文 (印度) | ta-IN | 泰盧固文 (印度) | te-IN |
| 荷蘭文 (荷蘭) | nl-NL | 韓文 (韓國) | ko-KR |
| 中文 (中國)* | cmn-CN | 波蘭文 (波蘭) | pl-PL |
| 俄文 (俄羅斯) | ru-RU | 泰文 (泰國) | th-TH |

*標示星號的語言可能有特定限制或特殊支援情況。