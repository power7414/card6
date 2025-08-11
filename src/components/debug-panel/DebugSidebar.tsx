import React, { useState } from 'react';
import { LogViewer } from './LogViewer';
import { ToolCallViewer } from './ToolCallViewer';
import { FiList, FiTool, FiFilter } from 'react-icons/fi';
import './debug-panel.scss';

type DebugTab = 'logs' | 'tools';

export const DebugSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DebugTab>('logs');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="debug-sidebar">
      <div className="debug-sidebar-header">
        <h2>除錯面板</h2>
        
        <div className="debug-tabs">
          <button
            className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
            aria-label="日誌"
          >
            <FiList />
            <span>日誌</span>
          </button>
          
          <button
            className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
            aria-label="工具呼叫"
          >
            <FiTool />
            <span>工具</span>
          </button>
        </div>

        <button
          className={`filter-button ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-label="篩選器"
        >
          <FiFilter />
        </button>
      </div>

      <div className="debug-sidebar-content">
        {activeTab === 'logs' && (
          <LogViewer showFilters={showFilters} />
        )}
        
        {activeTab === 'tools' && (
          <ToolCallViewer />
        )}
      </div>
    </div>
  );
};