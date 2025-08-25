import React, { memo, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { TwoColumnLayout } from './components/layout/TwoColumnLayout';
import { ChatSidebar } from './components/chat-room-sidebar/ChatSidebar';
import { ConversationArea } from './components/conversation-display/ConversationArea';
import { ChatInputArea } from './components/chat-input/ChatInputArea';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useChatManager } from './hooks/use-chat-manager';
import { useConversationEvents } from './hooks/use-conversation-events';
import { useTranscriptionIntegration } from './hooks/use-transcription';
import { initializeStorage } from './lib/indexeddb';
import { SettingsModal, SettingsData, ToneValue, VoiceValue } from './components/shared/SettingsModal';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import './App.scss';

// Import and enable session debugging
import { sessionDebugLogger } from './utils/session-debug';

// 啟用 session debug logging
if (process.env.NODE_ENV === 'development') {
  sessionDebugLogger.setEnabled(true);
}

// Live API 配置
const LIVE_API_OPTIONS = {
  apiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
};

// 除錯：檢查 API 金鑰
console.log('🔑 Live API Options:', {
  hasApiKey: !!LIVE_API_OPTIONS.apiKey,
  apiKeyLength: LIVE_API_OPTIONS.apiKey.length,
  apiKeyPrefix: LIVE_API_OPTIONS.apiKey.substring(0, 10) + '...'
});

// Memoized components to prevent unnecessary re-renders
const MemoizedChatSidebar = memo(ChatSidebar);
const MemoizedConversationArea = memo(ConversationArea);
const MemoizedChatInputArea = memo(ChatInputArea);

function AppContent() {
  // console.log('🏗️ [AppContent] 渲染，檢查除錯是否正常');
  const { error, clearError } = useChatManager();
  
  // console.log('🏗️ AppContent 渲染，準備初始化事件處理器');
  
  // 重新啟用事件處理器
  const { resetAIResponseState } = useConversationEvents();
  
  // 將重置函數存儲到全局，供其他組件使用
  useEffect(() => {
    (window as any).resetAIResponseState = resetAIResponseState;
    return () => {
      delete (window as any).resetAIResponseState;
    };
  }, [resetAIResponseState]);
  
  // 初始化轉錄整合
  useTranscriptionIntegration();
  
  // 設定 modal 狀態和設定管理
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const { settings: currentSettings, updateSettings } = useSettings();
  
  // console.log('✅ AppContent 事件處理器初始化完成');

  // 移除自動創建聊天室功能 - 讓用戶自行決定何時創建
  // React.useEffect(() => {
  //   if (chatRooms.length === 0 && !error) {
  //     createNewChatRoom().catch(console.error);
  //   }
  // }, [chatRooms.length, createNewChatRoom, error]);

  const handleSettings = React.useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSaveSettings = React.useCallback((newSettings: SettingsData) => {
    console.log('儲存設定:', newSettings);
    updateSettings(newSettings);
    setIsSettingsOpen(false);
  }, [updateSettings]);

  const handleHelp = React.useCallback(() => {
    // TODO: 實現幫助對話框
    console.log('打開幫助');
  }, []);

  // Show error state if chat manager has errors
  if (error) {
    return (
      <div className="app-error">
        <h2>Application Error</h2>
        <p>{error}</p>
        <button onClick={clearError}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <ErrorBoundary>
        <Header onSettingsClick={handleSettings} onHelpClick={handleHelp} />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <TwoColumnLayout
          leftPanel={<MemoizedChatSidebar />}
        >
          <div className="main-content">
            <ErrorBoundary>
              <MemoizedConversationArea />
            </ErrorBoundary>
            <ErrorBoundary>
              <MemoizedChatInputArea />
            </ErrorBoundary>
          </div>
        </TwoColumnLayout>
      </ErrorBoundary>
      
      {/* 設定 Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
        currentSettings={currentSettings}
      />
    </div>
  );
}

const MemoizedAppContent = memo(AppContent);

function App() {
  const [storageInitialized, setStorageInitialized] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);

  // Initialize storage system on app start
  React.useEffect(() => {
    const initStorage = async () => {
      try {
        const result = await initializeStorage({
          autoMigrate: true,
          clearLocalStorageAfterMigration: false // Keep localStorage as fallback
        });

        if (result.initialized) {
          console.log('Storage initialized successfully');
          if (result.migrationPerformed) {
            console.log('Data migration completed');
          }
        } else {
          console.warn('Storage initialization failed, using fallback:', result.error);
          setStorageError(result.error || 'Storage initialization failed');
        }
      } catch (error) {
        console.error('Failed to initialize storage:', error);
        setStorageError(error instanceof Error ? error.message : 'Unknown storage error');
      }
      
      setStorageInitialized(true);
    };

    initStorage();
  }, []);

  // Show loading state while storage is initializing
  if (!storageInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">Initializing storage...</div>
        {storageError && (
          <div className="storage-error">
            Warning: {storageError}. The app will continue with limited functionality.
          </div>
        )}
      </div>
    );
  }

  return (
    <SettingsProvider>
      <LiveAPIProvider options={LIVE_API_OPTIONS}>
        <MemoizedAppContent />
      </LiveAPIProvider>
    </SettingsProvider>
  );
}

export default App;