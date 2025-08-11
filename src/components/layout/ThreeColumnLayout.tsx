import React, { useEffect, ReactNode } from 'react';
import { CollapsiblePanel } from '../shared/CollapsiblePanel';
import { useUIStore } from '../../stores/ui-store';
import { settingsStorage, STORAGE_KEYS } from '../../lib/indexeddb';
import './layout.scss';

interface ThreeColumnLayoutProps {
  leftPanel: ReactNode;
  children: ReactNode;
  rightPanel: ReactNode;
}

export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  leftPanel,
  children,
  rightPanel
}) => {
  const {
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
    setMobile
  } = useUIStore();

  // 處理響應式設計
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setMobile(isMobile);
      
      // 在移動設備上自動收合側邊欄
      if (isMobile) {
        if (leftPanelOpen) toggleLeftPanel();
        if (rightPanelOpen) toggleRightPanel();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobile, toggleLeftPanel, toggleRightPanel]); // Remove leftPanelOpen, rightPanelOpen from deps

  // Load panel state from IndexedDB on component initialization
  useEffect(() => {
    let mounted = true; // Track if component is still mounted
    
    const loadPanelState = async () => {
      try {
        const savedState = await settingsStorage.getSetting(STORAGE_KEYS.PANEL_STATE);
        if (!mounted) return; // Don't update state if component unmounted
        
        if (savedState && typeof savedState === 'object') {
          const { left, right } = savedState as { left: boolean; right: boolean };
          if (typeof left === 'boolean' && left !== leftPanelOpen) {
            toggleLeftPanel();
          }
          if (typeof right === 'boolean' && right !== rightPanelOpen) {
            toggleRightPanel();
          }
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error('Failed to load panel state from IndexedDB:', error);
        // Fallback to localStorage if IndexedDB fails
        try {
          const savedState = localStorage.getItem('panelState');
          if (savedState) {
            const { left, right } = JSON.parse(savedState);
            if (left !== leftPanelOpen) toggleLeftPanel();
            if (right !== rightPanelOpen) toggleRightPanel();
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
  }, [leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel]); // Proper dependencies

  // Save panel state to IndexedDB whenever it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        await settingsStorage.setSetting(STORAGE_KEYS.PANEL_STATE, {
          left: leftPanelOpen,
          right: rightPanelOpen
        });
      } catch (error) {
        console.error('Failed to save panel state to IndexedDB:', error);
        // Fallback to localStorage if IndexedDB fails
        try {
          localStorage.setItem('panelState', JSON.stringify({
            left: leftPanelOpen,
            right: rightPanelOpen
          }));
        } catch (fallbackError) {
          console.error('Failed to save panel state to localStorage:', fallbackError);
        }
      }
    }, 300); // Debounce to avoid excessive writes

    return () => clearTimeout(timeoutId);
  }, [leftPanelOpen, rightPanelOpen]);

  return (
    <div className="three-column-layout">
      <CollapsiblePanel
        isOpen={leftPanelOpen}
        onToggle={toggleLeftPanel}
        position="left"
        width="300px"
        className="chat-sidebar-panel"
      >
        {leftPanel}
      </CollapsiblePanel>
      
      <main className="conversation-main">
        {children}
      </main>
      
      <CollapsiblePanel
        isOpen={rightPanelOpen}
        onToggle={toggleRightPanel}
        position="right"
        width="400px"
        className="debug-panel"
      >
        {rightPanel}
      </CollapsiblePanel>
    </div>
  );
};