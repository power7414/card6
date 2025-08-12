/**
 * Persistent Chat Store with IndexedDB Integration
 * 
 * This is an enhanced version of the chat store that automatically persists
 * data to IndexedDB and provides synchronization between memory and storage.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatRoom, Message } from '../types/chat';
import { chatRoomStorage, messageStorage, transcriptionStorage, settingsStorage } from '../lib/indexeddb';

// Timeout ID for debounced transcript updates
let transcriptUpdateTimeoutId: NodeJS.Timeout | null = null;

interface ChatState {
  // Core state
  chatRooms: ChatRoom[];
  activeChatRoom: string | null;
  currentTranscript: string;
  isRecording: boolean;
  
  // Loading and sync state
  isLoading: boolean;
  isInitialized: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  error: string | null; // Add error field for compatibility
  
  // Actions
  initialize: () => Promise<void>;
  addChatRoom: (chatRoom: ChatRoom) => Promise<void>;
  setActiveChatRoom: (chatRoomId: string) => Promise<void>;
  addMessage: (chatRoomId: string, message: Message) => Promise<void>;
  updateMessage: (chatRoomId: string, messageId: string, updater: (message: Message) => Message) => Promise<void>; // Add updateMessage method
  updateTranscript: (transcript: string) => void;
  setRecording: (recording: boolean) => void;
  deleteChatRoom: (chatRoomId: string) => Promise<void>;
  renameChatRoom: (chatRoomId: string, newName: string) => Promise<void>;
  clearTranscript: () => void;
  clearError: () => void; // Add clearError method
  
  // Sync actions
  syncFromStorage: () => Promise<void>;
  syncToStorage: () => Promise<void>;
  refreshChatRoom: (chatRoomId: string) => Promise<void>;
}

// Create store with subscribeWithSelector middleware for selective subscriptions
export const usePersistentChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    chatRooms: [],
    activeChatRoom: null,
    currentTranscript: '',
    isRecording: false,
    isLoading: false,
    isInitialized: false,
    lastSyncedAt: null,
    syncError: null,
    error: null,

    /**
     * Initialize the store by loading data from IndexedDB
     */
    initialize: async () => {
      const { isInitialized, isLoading } = get();
      
      if (isInitialized || isLoading) {
        return;
      }

      set({ isLoading: true, syncError: null });

      try {
        // Load chat rooms from storage
        const chatRooms = await chatRoomStorage.getAllChatRooms();
        
        // Load active chat room from settings
        const activeChatRoom = await settingsStorage.getSetting<string | null>('activeChatRoom', null);
        
        // Load transcript state
        const currentTranscript = await settingsStorage.getSetting<string>('currentTranscript', '');
        const isRecording = await settingsStorage.getSetting<boolean>('isRecording', false);

        set({
          chatRooms,
          activeChatRoom,
          currentTranscript,
          isRecording,
          isInitialized: true,
          isLoading: false,
          lastSyncedAt: new Date(),
          syncError: null
        });

        console.log(`Initialized chat store with ${chatRooms.length} chat rooms`);
      } catch (error) {
        console.error('Failed to initialize chat store:', error);
        set({
          isLoading: false,
          syncError: error instanceof Error ? error.message : 'Failed to initialize',
          // Set to initialized anyway so the app can function with empty state
          isInitialized: true
        });
      }
    },

    /**
     * Add a new chat room and persist it
     */
    addChatRoom: async (chatRoom) => {
      try {
        // Update memory state first for immediate UI feedback
        set((state) => ({
          chatRooms: [chatRoom, ...state.chatRooms],
          syncError: null
        }));

        // Persist to storage
        await chatRoomStorage.saveChatRoom(chatRoom);
        
        set({ lastSyncedAt: new Date() });
        console.log(`Added and persisted chat room: ${chatRoom.name}`);
      } catch (error) {
        console.error('Failed to persist new chat room:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to save chat room' });
        
        // Revert memory state on error
        set((state) => ({
          chatRooms: state.chatRooms.filter(room => room.id !== chatRoom.id)
        }));
        
        throw error;
      }
    },

    /**
     * Set active chat room and persist the selection
     */
    setActiveChatRoom: async (chatRoomId) => {
      try {
        // Update memory state
        set((state) => {
          const updatedChatRooms = state.chatRooms.map(room => 
            room.id === chatRoomId 
              ? { ...room, isActive: true }
              : { ...room, isActive: false }
          );
          return { 
            activeChatRoom: chatRoomId, 
            chatRooms: updatedChatRooms,
            syncError: null
          };
        });

        // Persist active chat room selection
        await settingsStorage.setSetting('activeChatRoom', chatRoomId);
        
        // Persist updated chat room data
        const { chatRooms } = get();
        const updatedRoom = chatRooms.find(room => room.id === chatRoomId);
        if (updatedRoom) {
          await chatRoomStorage.saveChatRoom(updatedRoom);
        }

        set({ lastSyncedAt: new Date() });
        console.log(`Set active chat room: ${chatRoomId}`);
      } catch (error) {
        console.error('Failed to persist active chat room:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to save active chat room' });
      }
    },

    /**
     * Add a message to a chat room and persist it
     */
    addMessage: async (chatRoomId, message) => {
      try {
        // Update memory state first
        set((state) => {
          const updatedChatRooms = state.chatRooms.map(room => 
            room.id === chatRoomId 
              ? { ...room, messages: [...room.messages, message], lastMessageAt: new Date() }
              : room
          );
          return { chatRooms: updatedChatRooms, syncError: null };
        });

        // Persist message to storage
        await messageStorage.addMessage(chatRoomId, message);
        
        // Update chat room metadata
        const { chatRooms } = get();
        const updatedRoom = chatRooms.find(room => room.id === chatRoomId);
        if (updatedRoom) {
          await chatRoomStorage.updateChatRoom(chatRoomId, {
            lastMessageAt: updatedRoom.lastMessageAt
          });
        }

        set({ lastSyncedAt: new Date() });
        console.log(`Added and persisted message to room ${chatRoomId}`);
      } catch (error) {
        console.error('Failed to persist message:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to save message' });
        
        // Revert memory state on error
        set((state) => {
          const revertedChatRooms = state.chatRooms.map(room => 
            room.id === chatRoomId 
              ? { ...room, messages: room.messages.filter(msg => msg.id !== message.id) }
              : room
          );
          return { chatRooms: revertedChatRooms };
        });
        
        throw error;
      }
    },

    /**
     * Update a message in a chat room and persist the change
     */
    updateMessage: async (chatRoomId, messageId, updater) => {
      try {
        // Update memory state first
        set((state) => {
          const updatedChatRooms = state.chatRooms.map(room => 
            room.id === chatRoomId 
              ? { 
                  ...room, 
                  messages: room.messages.map(msg => 
                    msg.id === messageId ? updater(msg) : msg
                  ),
                  lastMessageAt: new Date()
                }
              : room
          );
          return { chatRooms: updatedChatRooms, syncError: null };
        });

        // Get the updated message for persistence
        const { chatRooms } = get();
        const updatedRoom = chatRooms.find(room => room.id === chatRoomId);
        const updatedMessage = updatedRoom?.messages.find(msg => msg.id === messageId);

        if (updatedMessage) {
          // Persist message update to storage
          await messageStorage.updateMessage(chatRoomId, updatedMessage);
          
          // Update chat room metadata
          await chatRoomStorage.updateChatRoom(chatRoomId, {
            lastMessageAt: updatedRoom!.lastMessageAt
          });
        }

        set({ lastSyncedAt: new Date() });
        console.log(`Updated and persisted message ${messageId} in room ${chatRoomId}`);
      } catch (error) {
        console.error('Failed to persist message update:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to update message' });
        throw error;
      }
    },

    /**
     * Update current transcript (not persisted immediately for performance)
     */
    updateTranscript: (transcript) => {
      set({ currentTranscript: transcript });
      
      // Debounced persistence - save transcript after a delay
      if (transcriptUpdateTimeoutId) {
        clearTimeout(transcriptUpdateTimeoutId);
      }
      
      transcriptUpdateTimeoutId = setTimeout(async () => {
        try {
          await settingsStorage.setSetting('currentTranscript', transcript);
          set({ lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Failed to persist transcript:', error);
        }
      }, 1000);
    },

    /**
     * Set recording state and persist it
     */
    setRecording: (recording) => {
      set({ isRecording: recording });
      
      // Persist recording state
      settingsStorage.setSetting('isRecording', recording).catch(error => {
        console.error('Failed to persist recording state:', error);
      });
    },

    /**
     * Delete a chat room and remove it from storage
     */
    deleteChatRoom: async (chatRoomId) => {
      try {
        // Update memory state first
        set((state) => ({
          chatRooms: state.chatRooms.filter(room => room.id !== chatRoomId),
          activeChatRoom: state.activeChatRoom === chatRoomId ? null : state.activeChatRoom,
          syncError: null
        }));

        // Remove from storage
        await chatRoomStorage.deleteChatRoom(chatRoomId);
        
        // Update active chat room setting if needed
        const { activeChatRoom } = get();
        if (!activeChatRoom) {
          await settingsStorage.setSetting('activeChatRoom', null);
        }

        set({ lastSyncedAt: new Date() });
        console.log(`Deleted chat room: ${chatRoomId}`);
      } catch (error) {
        console.error('Failed to delete chat room:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to delete chat room' });
        
        // Note: We don't revert the memory state here as the delete might have partially succeeded
        throw error;
      }
    },

    /**
     * Rename a chat room and persist the change
     */
    renameChatRoom: async (chatRoomId, newName) => {
      try {
        const oldName = get().chatRooms.find(room => room.id === chatRoomId)?.name;
        
        // Update memory state first
        set((state) => ({
          chatRooms: state.chatRooms.map(room => 
            room.id === chatRoomId ? { ...room, name: newName } : room
          ),
          syncError: null
        }));

        // Persist to storage
        await chatRoomStorage.updateChatRoom(chatRoomId, { name: newName });

        set({ lastSyncedAt: new Date() });
        console.log(`Renamed chat room ${chatRoomId} from "${oldName}" to "${newName}"`);
      } catch (error) {
        console.error('Failed to rename chat room:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to rename chat room' });
        
        // Revert memory state on error
        const oldName = get().chatRooms.find(room => room.id === chatRoomId)?.name;
        if (oldName) {
          set((state) => ({
            chatRooms: state.chatRooms.map(room => 
              room.id === chatRoomId ? { ...room, name: oldName } : room
            )
          }));
        }
        
        throw error;
      }
    },

    /**
     * Clear current transcript
     */
    clearTranscript: () => {
      set({ currentTranscript: '' });
      
      // Clear from storage as well
      settingsStorage.setSetting('currentTranscript', '').catch(error => {
        console.error('Failed to clear transcript from storage:', error);
      });
    },

    /**
     * Clear error state
     */
    clearError: () => {
      set({ error: null, syncError: null });
    },

    /**
     * Sync data from storage to memory
     */
    syncFromStorage: async () => {
      try {
        set({ isLoading: true, syncError: null });

        const chatRooms = await chatRoomStorage.getAllChatRooms();
        const activeChatRoom = await settingsStorage.getSetting<string | null>('activeChatRoom', null);

        set({
          chatRooms,
          activeChatRoom,
          isLoading: false,
          lastSyncedAt: new Date()
        });

        console.log(`Synced ${chatRooms.length} chat rooms from storage`);
      } catch (error) {
        console.error('Failed to sync from storage:', error);
        set({
          isLoading: false,
          syncError: error instanceof Error ? error.message : 'Sync failed'
        });
      }
    },

    /**
     * Sync all current data to storage
     */
    syncToStorage: async () => {
      try {
        const { chatRooms, activeChatRoom, currentTranscript, isRecording } = get();
        
        set({ syncError: null });

        // Save all chat rooms
        for (const chatRoom of chatRooms) {
          await chatRoomStorage.saveChatRoom(chatRoom);
        }

        // Save settings
        await Promise.all([
          settingsStorage.setSetting('activeChatRoom', activeChatRoom),
          settingsStorage.setSetting('currentTranscript', currentTranscript),
          settingsStorage.setSetting('isRecording', isRecording)
        ]);

        set({ lastSyncedAt: new Date() });
        console.log(`Synced all data to storage`);
      } catch (error) {
        console.error('Failed to sync to storage:', error);
        set({ syncError: error instanceof Error ? error.message : 'Sync to storage failed' });
      }
    },

    /**
     * Refresh a specific chat room from storage
     */
    refreshChatRoom: async (chatRoomId) => {
      try {
        const chatRoom = await chatRoomStorage.getChatRoom(chatRoomId);
        
        if (chatRoom) {
          set((state) => ({
            chatRooms: state.chatRooms.map(room => 
              room.id === chatRoomId ? chatRoom : room
            ),
            syncError: null,
            lastSyncedAt: new Date()
          }));
          
          console.log(`Refreshed chat room: ${chatRoomId}`);
        }
      } catch (error) {
        console.error('Failed to refresh chat room:', error);
        set({ syncError: error instanceof Error ? error.message : 'Failed to refresh chat room' });
      }
    }
  }))
);

// Note: Transcript update debouncing is handled by the module-level transcriptUpdateTimeoutId variable

// Auto-initialize when the store is first accessed
let initPromise: Promise<void> | null = null;

export const initializeChatStore = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = usePersistentChatStore.getState().initialize();
  }
  return initPromise;
};

// Subscribe to changes and periodically sync to storage (debounced)
let syncTimeoutId: NodeJS.Timeout | null = null;
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

usePersistentChatStore.subscribe(
  (state) => ({ 
    chatRooms: state.chatRooms, 
    activeChatRoom: state.activeChatRoom,
    isInitialized: state.isInitialized 
  }),
  (current, previous) => {
    // Only sync if the store is initialized and data has actually changed
    if (current.isInitialized && (
      current.chatRooms !== previous.chatRooms || 
      current.activeChatRoom !== previous.activeChatRoom
    )) {
      // Debounce the sync operation
      if (syncTimeoutId) {
        clearTimeout(syncTimeoutId);
      }
      
      syncTimeoutId = setTimeout(() => {
        const state = usePersistentChatStore.getState();
        if (state.isInitialized) {
          state.syncToStorage().catch(error => {
            console.error('Background sync failed:', error);
          });
        }
      }, SYNC_DEBOUNCE_MS);
    }
  },
  {
    equalityFn: (a, b) => a.chatRooms === b.chatRooms && a.activeChatRoom === b.activeChatRoom
  }
);