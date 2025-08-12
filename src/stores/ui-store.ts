import { create } from 'zustand';

interface UIState {
  leftPanelOpen: boolean;
  isMobile: boolean;
  showWaveAnimation: boolean;
  currentVolume: number;
  
  // Actions
  toggleLeftPanel: () => void;
  setLeftPanel: (open: boolean) => void;
  setMobile: (mobile: boolean) => void;
  setShowWaveAnimation: (show: boolean) => void;
  setCurrentVolume: (volume: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelOpen: true,
  isMobile: false,
  showWaveAnimation: false,
  currentVolume: 0,

  toggleLeftPanel: () => set((state) => ({ 
    leftPanelOpen: !state.leftPanelOpen 
  })),

  setLeftPanel: (open) => set({ leftPanelOpen: open }),

  setMobile: (mobile) => set({ isMobile: mobile }),

  setShowWaveAnimation: (show) => set({ showWaveAnimation: show }),

  setCurrentVolume: (volume) => set({ currentVolume: volume })
}));