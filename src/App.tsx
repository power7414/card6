import React, { memo, useRef, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { ThreeColumnLayout } from './components/layout/ThreeColumnLayout';
import { ChatSidebar } from './components/chat-room-sidebar/ChatSidebar';
import { ConversationArea } from './components/conversation-display/ConversationArea';
import { ChatInputArea } from './components/chat-input/ChatInputArea';
import { ConsoleSidebar } from './components/console-sidebar/ConsoleSidebar';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useChatManager } from './hooks/use-chat-manager';
import { useConversationEvents } from './hooks/use-conversation-events';
import { useTranscriptionIntegration } from './hooks/use-transcription-integration';
import { initializeStorage } from './lib/indexeddb';
import './App.scss';

// Live API 配置
const LIVE_API_OPTIONS = {
  apiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
};

// Memoized components to prevent unnecessary re-renders
const MemoizedChatSidebar = memo(ChatSidebar);
const MemoizedConsoleSidebar = memo(ConsoleSidebar);
const MemoizedConversationArea = memo(ConversationArea);
const MemoizedChatInputArea = memo(ChatInputArea);

function AppContent() {
  const { chatRooms, createNewChatRoom, error, clearError } = useChatManager();
  
  console.log('🏗️ AppContent 渲染，準備初始化事件處理器');
  
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
  
  console.log('✅ AppContent 事件處理器初始化完成');

  // 移除自動創建聊天室功能 - 讓用戶自行決定何時創建
  // React.useEffect(() => {
  //   if (chatRooms.length === 0 && !error) {
  //     createNewChatRoom().catch(console.error);
  //   }
  // }, [chatRooms.length, createNewChatRoom, error]);

  const handleSettings = React.useCallback(() => {
    // TODO: 實現設定對話框
    console.log('打開設定');
  }, []);

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
        <ThreeColumnLayout
          leftPanel={<MemoizedChatSidebar />}
          rightPanel={<MemoizedConsoleSidebar />}
        >
          <div className="main-content">
            <ErrorBoundary>
              <MemoizedConversationArea />
            </ErrorBoundary>
            <ErrorBoundary>
              <MemoizedChatInputArea />
            </ErrorBoundary>
          </div>
        </ThreeColumnLayout>
      </ErrorBoundary>
    </div>
  );
}

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
    <LiveAPIProvider options={LIVE_API_OPTIONS}>
      <AppContent />
    </LiveAPIProvider>
  );
}

export default App;