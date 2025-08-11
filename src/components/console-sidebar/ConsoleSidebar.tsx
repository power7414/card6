import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from 'react-icons/ri';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
// ConsoleSidebar 不再需要聊天相關的 imports
import { useLoggerStore } from '../../lib/store-logger';
import { Logger } from './Logger';
import { LoggerFilterType } from './types';
import './console-sidebar.scss';

interface ConsoleSidebarProps {
  className?: string;
  defaultOpen?: boolean;
  width?: string;
}

const filterOptions = [
  { value: 'all', label: 'All Logs' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'tools', label: 'Tool Calls' },
  { value: 'errors', label: 'Errors' },
  { value: 'system', label: 'System' }
] as const;

export const ConsoleSidebar: React.FC<ConsoleSidebarProps> = ({
  className = '',
  defaultOpen = true,
  width = '400px'
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<LoggerFilterType>('all');
  
  // ConsoleSidebar 只負責日誌記錄，不處理聊天訊息
  
  // Refs
  const loggerContainerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);

  // Hooks
  const { connected, client } = useLiveAPIContext();
  const { logs, log, clearLogs } = useLoggerStore();

  // Auto-scroll to bottom when new logs come in
  useEffect(() => {
    if (loggerContainerRef.current) {
      const el = loggerContainerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  // Listen for log events from Live API
  useEffect(() => {
    console.log('🔧 ConsoleSidebar useEffect 執行，client:', !!client);
    if (client) {
      console.log('🔧 ConsoleSidebar 開始監聽事件');
      client.on('log', log);
      
      // 🔧 轉錄事件處理：更新對話內容
      const handleOutputTranscription = (transcription: any) => {
        // ConsoleSidebar 只負責日誌記錄，不創建聊天訊息
        log({
          date: new Date(),
          type: 'transcription',
          message: `AI 轉錄: ${transcription.text} (final: ${transcription.isFinal})`
        });
      };
      
      // 處理對話完成事件
      const handleTurnComplete = () => {
        // ConsoleSidebar 只記錄日誌
        log({
          date: new Date(),
          type: 'system',
          message: 'AI 回應完成'
        });
      };

      client.on('output_transcription', handleOutputTranscription);
      client.on('turncomplete', handleTurnComplete);
      
      return () => {
        client.off('log', log);
        client.off('output_transcription', handleOutputTranscription);
        client.off('turncomplete', handleTurnComplete);
      };
    }
  }, [client, log]);


  // Toggle sidebar open/closed
  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // Get current connection status
  const getConnectionStatus = () => {
    if (connected) {
      return {
        icon: '🔵',
        text: isOpen ? 'Connected' : '',
        className: 'connected'
      };
    } else {
      return {
        icon: '⏸️',
        text: isOpen ? 'Disconnected' : '',
        className: 'disconnected'
      };
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div 
      className={`console-sidebar ${isOpen ? 'open' : 'closed'} ${className}`}
      style={{ width: isOpen ? width : '40px' }}
    >
      {/* Header */}
      <header className="console-header">
        <h2 className="console-title">Console</h2>
        <button 
          className="toggle-button"
          onClick={toggleSidebar}
          aria-label={`${isOpen ? 'Close' : 'Open'} console sidebar`}
        >
          {isOpen ? <RiSidebarFoldLine /> : <RiSidebarUnfoldLine />}
        </button>
      </header>

      {isOpen && (
        <>
          {/* Controls Section */}
          <section className="console-controls">
            {/* Search Bar */}
            <div className="search-container">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="clear-search-button"
                  aria-label="Clear search"
                >
                  <FiX />
                </button>
              )}
            </div>

            {/* Filter Dropdown */}
            <div className="filter-container">
              <FiFilter className="filter-icon" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as LoggerFilterType)}
                className="filter-select"
              >
                {filterOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Indicator */}
            <div className={`status-indicator ${connectionStatus.className}`}>
              <span className="status-icon">{connectionStatus.icon}</span>
              <span className="status-text">{connectionStatus.text}</span>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={clearLogs}
                className="clear-logs-button"
                title="Clear all logs"
              >
                Clear
              </button>
            </div>
          </section>

          {/* Logger Container */}
          <div className="logger-container" ref={loggerContainerRef}>
            <Logger
              filter={selectedFilter}
              searchTerm={searchTerm}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ConsoleSidebar;