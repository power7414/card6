import React, { useEffect, ReactNode } from 'react';
import { CollapsiblePanel } from '../shared/CollapsiblePanel';
import { useUIStore } from '../../stores/ui-store';
import { settingsStorage, STORAGE_KEYS } from '../../lib/indexeddb';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './layout.scss';

interface TwoColumnLayoutProps {
  leftPanel: ReactNode;
  children: ReactNode;
}

export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  leftPanel,
  children
}) => {
  const {
    leftPanelOpen,
    toggleLeftPanel,
    setMobile
  } = useUIStore();

  // 處理響應式設計
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobile(isMobile);
      
      // 在移動設備上自動收合側邊欄
      if (isMobile && leftPanelOpen) {
        toggleLeftPanel();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobile, toggleLeftPanel, leftPanelOpen]);

  // Load panel state from IndexedDB on component initialization ONLY
  useEffect(() => {
    let mounted = true; // Track if component is still mounted
    
    const loadPanelState = async () => {
      try {
        const savedState = await settingsStorage.getSetting(STORAGE_KEYS.PANEL_STATE);
        if (!mounted) return; // Don't update state if component unmounted
        
        if (savedState && typeof savedState === 'object') {
          const { left } = savedState as { left: boolean };
          if (typeof left === 'boolean') {
            // Use setLeftPanel to avoid race conditions with toggleLeftPanel
            const { setLeftPanel } = useUIStore.getState();
            setLeftPanel(left);
          }
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error('Failed to load panel state from IndexedDB:', error);
        // Fallback to localStorage if IndexedDB fails
        try {
          const savedState = localStorage.getItem('panelState');
          if (savedState) {
            const { left } = JSON.parse(savedState);
            if (typeof left === 'boolean') {
              const { setLeftPanel } = useUIStore.getState();
              setLeftPanel(left);
            }
          }
        } catch (fallbackError) {
          console.error('Failed to parse saved panel state from localStorage:', fallbackError);
        }
      }
    };

    loadPanelState();
    
    return () => {
      mounted = false; // Cleanup: mark as unmounted
    };
  }, []); // FIXED: Remove dependencies to prevent race conditions

  // Save panel state to IndexedDB whenever it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        await settingsStorage.setSetting(STORAGE_KEYS.PANEL_STATE, {
          left: leftPanelOpen
        });
      } catch (error) {
        console.error('Failed to save panel state to IndexedDB:', error);
        // Fallback to localStorage if IndexedDB fails
        try {
          localStorage.setItem('panelState', JSON.stringify({
            left: leftPanelOpen
          }));
        } catch (fallbackError) {
          console.error('Failed to save panel state to localStorage:', fallbackError);
        }
      }
    }, 300); // Debounce to avoid excessive writes
    
    return () => clearTimeout(timeoutId);
  }, [leftPanelOpen]);

  return (
    <div className="two-column-layout">
      <CollapsiblePanel
        isOpen={leftPanelOpen}
        onToggle={() => {}} // 禁用內建按鈕的功能
        position="left"
        width="300px"
        className="chat-sidebar-panel hide-internal-toggle"
      >
        {leftPanel}
      </CollapsiblePanel>
      
      <main className="conversation-main">
        {children}
      </main>
      
      {/* 收合按鈕 */}
      <button
        className={`sidebar-toggle-btn ${leftPanelOpen ? 'open' : 'closed'}`}
        onClick={toggleLeftPanel}
        aria-label={leftPanelOpen ? '收合聊天室列表' : '展開聊天室列表'}
      >
        {leftPanelOpen ? (
          <FiChevronLeft className="icon" />
        ) : (
          <FiChevronRight className="icon" />
        )}
      </button>
    </div>
  );
};