import React from 'react';
import { FiMenu, FiSettings, FiHelpCircle, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useChatManager } from '../../hooks/use-chat-manager';
import './layout.scss';

interface HeaderProps {
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSettingsClick,
  onHelpClick
}) => {
  const { connected, connectWithResumption } = useLiveAPIContext();
  const { activeChatRoom, createNewChatRoom } = useChatManager();

  const handleConnect = async () => {
    if (!connected) {
      try {
        let targetChatRoom = activeChatRoom;
        
        // If no active chat room, create a new one
        if (!targetChatRoom) {
          console.log('🏗️ 沒有活動聊天室，創建新的聊天室...');
          targetChatRoom = await createNewChatRoom();
        }
        
        console.log('🔌 使用 session resumption 連接到聊天室:', targetChatRoom);
        await connectWithResumption(targetChatRoom);
      } catch (error) {
        console.error('連接失敗:', error);
      }
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-button" aria-label="Menu">
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