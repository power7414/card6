import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * Minimal test component to isolate sidebar toggle functionality
 * Use this to test if the issue is with the UI store or component-specific logic
 */
export const ToggleTest: React.FC = () => {
  const { leftPanelOpen, toggleLeftPanel, setLeftPanel } = useUIStore();
  const [localState, setLocalState] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const [lastToggleTime, setLastToggleTime] = useState<number>(0);

  useEffect(() => {
    console.log('🔍 ToggleTest: useUIStore leftPanelOpen changed to:', leftPanelOpen);
  }, [leftPanelOpen]);

  useEffect(() => {
    console.log('🔍 ToggleTest: local state changed to:', localState);
  }, [localState]);

  const handleZustandToggle = () => {
    const now = Date.now();
    setClickCount(prev => prev + 1);
    setLastToggleTime(now);
    console.log(`🖱️ ToggleTest: Zustand toggle #${clickCount + 1} at ${now}`);
    console.log('🔍 Before toggle - leftPanelOpen:', leftPanelOpen);
    
    toggleLeftPanel();
    
    // Check state immediately (might not be updated yet due to async nature)
    setTimeout(() => {
      console.log('🔍 After toggle - leftPanelOpen:', useUIStore.getState().leftPanelOpen);
    }, 0);
  };

  const handleLocalToggle = () => {
    console.log('🖱️ ToggleTest: Local toggle');
    setLocalState(prev => !prev);
  };

  const handleDirectStateSet = () => {
    console.log('🖱️ ToggleTest: Direct state set');
    setLeftPanel(!leftPanelOpen);
  };

  const handleManualStoreAccess = () => {
    console.log('🖱️ ToggleTest: Manual store access');
    const store = useUIStore.getState();
    console.log('🔍 Current store state:', store.leftPanelOpen);
    store.toggleLeftPanel();
    console.log('🔍 After manual toggle:', useUIStore.getState().leftPanelOpen);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '20px',
      background: 'white',
      padding: '20px',
      border: '2px solid #ccc',
      borderRadius: '8px',
      zIndex: 9999,
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
    }}>
      <h3>Toggle Debug Panel</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>States:</strong><br />
        Zustand: {leftPanelOpen ? 'OPEN' : 'CLOSED'}<br />
        Local: {localState ? 'OPEN' : 'CLOSED'}<br />
        Click Count: {clickCount}<br />
        Last Toggle: {lastToggleTime}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          onClick={handleZustandToggle}
          style={{ padding: '8px', backgroundColor: leftPanelOpen ? '#f44336' : '#4caf50' }}
        >
          {leftPanelOpen ? <FiChevronLeft /> : <FiChevronRight />}
          Zustand Toggle
        </button>

        <button 
          onClick={handleLocalToggle}
          style={{ padding: '8px', backgroundColor: localState ? '#f44336' : '#4caf50' }}
        >
          {localState ? <FiChevronLeft /> : <FiChevronRight />}
          Local Toggle
        </button>

        <button onClick={handleDirectStateSet} style={{ padding: '8px' }}>
          Direct setLeftPanel
        </button>

        <button onClick={handleManualStoreAccess} style={{ padding: '8px' }}>
          Manual Store Access
        </button>

        <button 
          onClick={() => {
            console.clear();
            setClickCount(0);
            setLastToggleTime(0);
          }}
          style={{ padding: '8px', backgroundColor: '#ff9800' }}
        >
          Clear Debug
        </button>
      </div>
    </div>
  );
};