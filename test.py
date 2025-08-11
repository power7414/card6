#!/usr/bin/env python3
"""
Live API Interactive Chat - Real-time Multi-turn Conversation
基於 Google Live API 的即時多輪對話測試

功能:
- 即時多輪對話，像聊天室一樣
- 文字輸入，語音輸出
- 即時顯示 AI 語音的轉錄內容
- 支援語音配置和會話管理
- 輸入 'quit', 'exit', 'bye' 結束對話
"""

import asyncio
import wave
import os
import threading
import queue
from datetime import datetime
from google import genai

# 載入 .env 檔案
def load_env():
    """載入 .env 檔案中的環境變數"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

# 載入環境變數
load_env()

# API 設定
API_KEY = (
    os.getenv('REACT_APP_GEMINI_API_KEY') or 
    os.getenv('GOOGLE_AI_API_KEY') or 
    os.getenv('GEMINI_API_KEY')
)

if not API_KEY:
    print("請設定 API Key！")
    print("在 .env 檔案中設定 REACT_APP_GEMINI_API_KEY")
    exit(1)

# 配置設定
MODEL = "gemini-live-2.5-flash-preview"
AUDIO_DIR = "conversation_audio"

# 語音配置選項
# 支援的語言代碼（根據官方文件）:
# - "cmn-CN": 中文 (中國)
# - "en-US": 英文 (美國)
# - "ja-JP": 日文 (日本)
# - "ko-KR": 韓文 (韓國)
# - "de-DE": 德文 (德國)
# - "fr-FR": 法文 (法國)
# - "es-ES": 西班牙文 (西班牙)
# - 更多語言請參考官方文件

# 支援的語音名稱（半連鎖模型）:
# Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr

class InteractiveChat:
    def __init__(self):
        self.client = genai.Client(api_key=API_KEY)
        self.session = None
        self.audio_file = None
        self.wave_file = None
        self.message_queue = queue.Queue()
        self.is_running = False
        self.turn_count = 0
        self.session_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 創建音訊目錄
        if not os.path.exists(AUDIO_DIR):
            os.makedirs(AUDIO_DIR)
    
    def setup_turn_audio_recording(self, turn_number):
        """為每一輪對話設置獨立的音訊錄製"""
        # 關閉前一輪的音訊文件
        if self.wave_file:
            self.wave_file.close()
            if self.audio_file and os.path.exists(self.audio_file):
                size = os.path.getsize(self.audio_file)
                if size > 1000:
                    print(f"💾 第 {turn_number - 1} 輪音訊已保存: {self.audio_file} ({size:,} bytes)")
                else:
                    print(f"⚠️ 第 {turn_number - 1} 輪音訊文件很小，可能沒有內容")
        
        # 創建新的音訊文件
        self.audio_file = os.path.join(AUDIO_DIR, f"conversation_{self.session_timestamp}_round{turn_number}.wav")
        
        self.wave_file = wave.open(self.audio_file, "wb")
        self.wave_file.setnchannels(1)      # 單聲道
        self.wave_file.setsampwidth(2)      # 16-bit
        self.wave_file.setframerate(24000)  # 24kHz
        
        print(f"🎵 第 {turn_number} 輪音訊將保存至: {self.audio_file}")
    
    def setup_audio_recording(self):
        """設置音訊錄製 - 保留舊方法以兼容性"""
        # 這個方法現在什麼都不做，因為我們會在每輪對話時設置
        pass
    
    def input_thread(self):
        """輸入線程 - 處理用戶輸入"""
        while self.is_running:
            try:
                user_input = input().strip()
                if user_input:
                    self.message_queue.put(user_input)
            except (EOFError, KeyboardInterrupt):
                self.message_queue.put("quit")
                break
    
    async def send_message(self, message):
        """發送訊息給 AI"""
        if not self.session:
            return False
        
        try:
            await self.session.send_client_content(
                turns={"role": "user", "parts": [{"text": message}]},
                turn_complete=True
            )
            return True
        except Exception as e:
            print(f"❌ 發送訊息失敗: {e}")
            return False
    
    async def process_response(self):
        """處理 AI 回應"""
        if not self.session:
            return
        
        print("🤖 AI: ", end="", flush=True)
        audio_received = False
        transcription_parts = []
        
        try:
            async for response in self.session.receive():
                # 處理音訊資料
                if response.data is not None and self.wave_file:
                    self.wave_file.writeframes(response.data)
                    if not audio_received:
                        audio_received = True
                
                # 處理轉錄文字 - 即時顯示
                if (hasattr(response, 'server_content') and 
                    response.server_content and 
                    hasattr(response.server_content, 'output_transcription') and
                    response.server_content.output_transcription):
                    text = response.server_content.output_transcription.text
                    print(text, end="", flush=True)
                    transcription_parts.append(text)
                
                # 檢查回合是否完成
                if (hasattr(response, 'server_content') and 
                    response.server_content and 
                    hasattr(response.server_content, 'turn_complete') and
                    response.server_content.turn_complete):
                    print()  # 換行
                    break
                    
        except Exception as e:
            print(f"\n❌ 處理回應時發生錯誤: {e}")
    
    async def chat_loop(self):
        """主要對話循環"""
        print("\n" + "="*60)
        print("💬 即時多輪對話開始！")
        print("💡 提示:")
        print("   - 輸入訊息後按 Enter")
        print("   - 輸入 'quit', 'exit', 'bye', '退出', '結束' 結束對話")
        print("   - AI 會用中文語音回應並顯示轉錄文字")
        print("   - 建議測試: '你好', '介紹一下自己', '講個笑話'")
        print("="*60)
        
        # 啟動輸入線程
        self.is_running = True
        input_thread = threading.Thread(target=self.input_thread, daemon=True)
        input_thread.start()
        
        print("\n👤 你: ", end="", flush=True)
        
        while self.is_running:
            try:
                # 檢查是否有新的用戶輸入
                try:
                    message = self.message_queue.get(timeout=0.1)
                    
                    # 檢查退出命令（支援中英文）
                    if message.lower() in ['quit', 'exit', 'bye', 'q', '退出', '結束', '再見']:
                        print("👋 再見！結束對話...")
                        break
                    
                    self.turn_count += 1
                    print(f"({self.turn_count}) {message}")
                    
                    # 為這一輪對話設置獨立的音訊錄製
                    self.setup_turn_audio_recording(self.turn_count)
                    
                    # 發送訊息
                    if await self.send_message(message):
                        # 處理 AI 回應
                        await self.process_response()
                        
                        # 準備下一輪輸入
                        print("👤 你: ", end="", flush=True)
                    
                except queue.Empty:
                    # 沒有新訊息，繼續等待
                    await asyncio.sleep(0.1)
                    continue
                    
            except KeyboardInterrupt:
                print("\n🛑 對話被中斷")
                break
            except Exception as e:
                print(f"\n❌ 對話中發生錯誤: {e}")
                break
        
        self.is_running = False
    
    async def run(self):
        """運行互動對話"""
        print("🚀 啟動即時對話會話...")
        print("🌏 語言設定: 中文 (cmn-CN)")
        print("🎤 語音: Aoede")
        
        # 配置設定 - 中文語音配置
        config = {
            "response_modalities": ["AUDIO"],
            "output_audio_transcription": {},
            "speech_config": {
                "language_code": "cmn-CN",  # 中文 (中國) - 根據官方文件支援的語言
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": "Aoede"  # 選擇適合中文的語音，可嘗試其他: Puck, Charon, Kore, Fenrir, Leda, Orus, Zephyr
                    }
                }
            }
        }
        
        try:
            # 使用正確的 async with 模式
            async with self.client.aio.live.connect(model=MODEL, config=config) as session:
                self.session = session
                print("✅ 會話連接成功")
                
                # 音訊錄製將在每輪對話時設置
                
                try:
                    # 開始對話循環
                    await self.chat_loop()
                finally:
                    # 清理音訊資源
                    await self.cleanup_audio()
                    
        except Exception as e:
            print(f"❌ 連接失敗: {e}")
            return
    
    async def cleanup_audio(self):
        """清理音訊資源"""
        print("\n🧹 清理資源中...")
        
        # 關閉最後一輪的音訊文件
        if self.wave_file:
            self.wave_file.close()
            if self.audio_file and os.path.exists(self.audio_file):
                size = os.path.getsize(self.audio_file)
                if size > 1000:
                    print(f"💾 第 {self.turn_count} 輪音訊已保存: {self.audio_file} ({size:,} bytes)")
                else:
                    print(f"⚠️ 第 {self.turn_count} 輪音訊文件很小，可能沒有內容")
        
        # 顯示所有音訊文件的摘要
        print(f"\n📁 音訊文件保存在目錄: {AUDIO_DIR}")
        audio_files = []
        if os.path.exists(AUDIO_DIR):
            for filename in os.listdir(AUDIO_DIR):
                if filename.startswith(f"conversation_{self.session_timestamp}_round") and filename.endswith('.wav'):
                    audio_files.append(filename)
        
        if audio_files:
            audio_files.sort()  # 按文件名排序
            print(f"🎧 生成了 {len(audio_files)} 個音訊文件:")
            for filename in audio_files:
                filepath = os.path.join(AUDIO_DIR, filename)
                size = os.path.getsize(filepath)
                print(f"   - {filename} ({size:,} bytes)")
            print("🎵 可以使用音訊播放器分別播放每輪對話")
        else:
            print("⚠️ 沒有找到音訊文件")
        
        print("✅ 會話已關閉")
        print(f"📈 總共進行了 {self.turn_count} 輪對話")

async def main():
    """主函數"""
    print("=" * 60)
    print("🎙️ Google Live API 即時多輪對話測試")
    print("=" * 60)
    
    # 顯示 API Key 狀態
    if API_KEY:
        print(f"🔑 API Key: {API_KEY[:10]}...{API_KEY[-4:]}")
    else:
        print("❌ 未找到 API Key")
        return
    
    # 創建並運行對話
    chat = InteractiveChat()
    await chat.run()

if __name__ == "__main__":
    print("📦 確保已安裝: pip install google-genai")
    print("")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 程式已退出")
    except Exception as e:
        print(f"❌ 程式錯誤: {e}")