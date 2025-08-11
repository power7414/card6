import { useState, useCallback, useEffect } from 'react';
import { LoggerFilterType } from './types';
import { settingsStorage, STORAGE_KEYS } from '../../lib/indexeddb';

interface ConsoleSidebarState {
  isOpen: boolean;
  searchTerm: string;
  selectedFilter: LoggerFilterType;
  autoScroll: boolean;
}

interface ConsoleSidebarActions {
  toggleSidebar: () => void;
  setSearchTerm: (term: string) => void;
  setFilter: (filter: LoggerFilterType) => void;
  clearSearch: () => void;
  resetFilters: () => void;
  setAutoScroll: (enabled: boolean) => void;
}

interface UseConsoleSidebarOptions {
  defaultOpen?: boolean;
  defaultFilter?: LoggerFilterType;
  autoScroll?: boolean;
  persistState?: boolean;
  storageKey?: string;
}

const DEFAULT_STATE: ConsoleSidebarState = {
  isOpen: true,
  searchTerm: '',
  selectedFilter: 'all',
  autoScroll: true,
};

export function useConsoleSidebar(options: UseConsoleSidebarOptions = {}) {
  const {
    defaultOpen = true,
    defaultFilter = 'all',
    autoScroll = true,
    persistState = false,
    storageKey = 'consoleSidebarState',
  } = options;

  // Initialize state with defaults
  const [state, setState] = useState<ConsoleSidebarState>({
    ...DEFAULT_STATE,
    isOpen: defaultOpen,
    selectedFilter: defaultFilter,
    autoScroll,
  });

  // Load state from IndexedDB on mount
  useEffect(() => {
    if (persistState) {
      const loadSavedState = async () => {
        try {
          const savedState = await settingsStorage.getSetting(storageKey);
          if (savedState && typeof savedState === 'object') {
            setState(prev => ({
              ...prev,
              ...savedState,
              isOpen: defaultOpen, // Always use prop for initial open state
            }));
          }
        } catch (error) {
          console.warn('Failed to load console sidebar state from IndexedDB:', error);
          // Fallback to localStorage
          try {
            const savedState = localStorage.getItem(storageKey);
            if (savedState) {
              const parsed = JSON.parse(savedState);
              setState(prev => ({
                ...prev,
                ...parsed,
                isOpen: defaultOpen,
              }));
            }
          } catch (fallbackError) {
            console.warn('Failed to load console sidebar state from localStorage:', fallbackError);
          }
        }
      };

      loadSavedState();
    }
  }, [persistState, storageKey, defaultOpen]);

  // Persist state to IndexedDB when it changes
  useEffect(() => {
    if (persistState) {
      const saveState = async () => {
        try {
          await settingsStorage.setSetting(storageKey, state);
        } catch (error) {
          console.warn('Failed to save console sidebar state to IndexedDB:', error);
          // Fallback to localStorage
          try {
            localStorage.setItem(storageKey, JSON.stringify(state));
          } catch (fallbackError) {
            console.warn('Failed to save console sidebar state to localStorage:', fallbackError);
          }
        }
      };

      saveState();
    }
  }, [state, persistState, storageKey]);

  // Actions
  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setState(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const setFilter = useCallback((filter: LoggerFilterType) => {
    setState(prev => ({ ...prev, selectedFilter: filter }));
  }, []);

  const clearSearch = useCallback(() => {
    setState(prev => ({ ...prev, searchTerm: '' }));
  }, []);

  const resetFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchTerm: '',
      selectedFilter: 'all',
    }));
  }, []);

  const setAutoScroll = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, autoScroll: enabled }));
  }, []);

  const actions: ConsoleSidebarActions = {
    toggleSidebar,
    setSearchTerm,
    setFilter,
    clearSearch,
    resetFilters,
    setAutoScroll,
  };

  return {
    ...state,
    ...actions,
  };
}

export default useConsoleSidebar;