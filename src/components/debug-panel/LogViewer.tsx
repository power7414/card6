import React, { useState, useEffect } from 'react';
import { FiClock, FiInfo, FiAlertTriangle, FiXCircle } from 'react-icons/fi';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  data?: any;
}

interface LogViewerProps {
  showFilters: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({ showFilters }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 模擬日誌數據
  useEffect(() => {
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(),
        level: 'info',
        message: 'Live API 連接已建立',
        data: { connectionId: 'conn_123' }
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 5000),
        level: 'info',
        message: '開始錄音',
        data: { sampleRate: 16000 }
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 10000),
        level: 'warning',
        message: '音量過低，可能影響識別準確度',
        data: { volume: 0.1 }
      }
    ];
    setLogs(mockLogs);
  }, []);

  // 過濾日誌
  useEffect(() => {
    let filtered = logs;

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, levelFilter, searchTerm]);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'warning':
        return <FiAlertTriangle className="warning" />;
      case 'error':
        return <FiXCircle className="error" />;
      default:
        return <FiInfo className="info" />;
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="log-viewer">
      {showFilters && (
        <div className="log-filters">
          <div className="filter-row">
            <input
              type="text"
              placeholder="搜尋日誌..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-row">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="level-filter"
            >
              <option value="all">所有級別</option>
              <option value="info">資訊</option>
              <option value="warning">警告</option>
              <option value="error">錯誤</option>
            </select>

            <button onClick={clearLogs} className="clear-button">
              清除日誌
            </button>
          </div>
        </div>
      )}

      <div className="log-list">
        {filteredLogs.length === 0 ? (
          <div className="log-empty">
            <p>無日誌記錄</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className={`log-entry ${log.level}`}>
              <div className="log-header">
                <div className="log-icon">
                  {getLogIcon(log.level)}
                </div>
                
                <div className="log-time">
                  <FiClock />
                  <span>{formatTime(log.timestamp)}</span>
                </div>
              </div>

              <div className="log-message">
                {log.message}
              </div>

              {log.data && (
                <div className="log-data">
                  <pre>{JSON.stringify(log.data, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};