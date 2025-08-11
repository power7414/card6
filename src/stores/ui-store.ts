import { create } from 'zustand';

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  isMobile: boolean;
  showWaveAnimation: boolean;
  currentVolume: number;
  
  // Actions
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanel: (open: boolean) => void;
  setRightPanel: (open: boolean) => void;
  setMobile: (mobile: boolean) => void;
  setShowWaveAnimation: (show: boolean) => void;
  setCurrentVolume: (volume: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  isMobile: false,
  showWaveAnimation: false,
  currentVolume: 0,

  toggleLeftPanel: () => set((state) => ({ 
    leftPanelOpen: !state.leftPanelOpen 
  })),

  toggleRightPanel: () => set((state) => ({ 
    rightPanelOpen: !state.rightPanelOpen 
  })),

  setLeftPanel: (open) => set({ leftPanelOpen: open }),

  setRightPanel: (open) => set({ rightPanelOpen: open }),

  setMobile: (mobile) => set({ isMobile: mobile }),

  setShowWaveAnimation: (show) => set({ showWaveAnimation: show }),

  setCurrentVolume: (volume) => set({ currentVolume: volume })
}));