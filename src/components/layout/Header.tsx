import React from 'react';
import { FiMenu, FiSettings, FiHelpCircle, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useChatManager } from '../../hooks/use-chat-manager';
import { useUIStore } from '../../stores/ui-store';
import './layout.scss';

interface HeaderProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSettingsClick,
  onHelpClick
}) => {
  const { connected, connectWithResumption, sessionTimeLeft } = useLiveAPIContext();
  const { activeChatRoom, createNewChatRoom } = useChatManager();
  const { toggleLeftPanel } = useUIStore();

  const handleConnect = async () => {
    console.log('🎯 [Header] handleConnect 被呼叫，connected:', connected);
    if (!connected) {
      try {
        let targetChatRoom = activeChatRoom;
        
        // If no active chat room, create a new one
        if (!targetChatRoom) {
          console.log('🏗️ [Header] 沒有活動聊天室，創建新的聊天室...');
          targetChatRoom = await createNewChatRoom();
        }
        
        console.log('🔌 [Header] 使用 session resumption 連接到聊天室:', {
          chatRoomId: targetChatRoom,
          activeChatRoom,
          timestamp: new Date().toISOString()
        });
        await connectWithResumption(targetChatRoom);
        console.log('✅ [Header] connectWithResumption 完成');
      } catch (error) {
        console.error('❌ [Header] 連接失敗:', error);
      }
    } else {
      console.log('⚠️ [Header] 已經連接，跳過連接動作');
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button 
          className="menu-button" 
          onClick={toggleLeftPanel}
          aria-label="Toggle sidebar"
        >
          <FiMenu />
        </button>
        <h1 className="app-title">對話測試平台</h1>
      </div>
      
      <div className="header-center">
        <button 
          className={`connection-status ${connected ? 'connected' : 'disconnected'}`}
          onClick={handleConnect}
          aria-label={connected ? 'API 已連接' : '點擊連接 API'}
        >
          {connected ? <FiWifi /> : <FiWifiOff />}
          <span>{connected ? '已連接' : '未連接'}</span>
        </button>
        
        {connected && sessionTimeLeft !== null && (
          <div className="session-timer">
            <span className="timer-label">剩餘時間：</span>
            <span className="timer-value">
              {Math.floor(sessionTimeLeft / 60)}:{String(sessionTimeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>
      
      <div className="header-right">
        <button 
          className="icon-button" 
          onClick={onSettingsClick}
          aria-label="Settings"
        >
          <FiSettings />
          <span>設定</span>
        </button>
        
        <button 
          className="icon-button" 
          onClick={onHelpClick}
          aria-label="Help"
        >
          <FiHelpCircle />
          <span>幫助</span>
        </button>
      </div>
    </header>
  );
};