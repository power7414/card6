import { create } from 'zustand';
import { ChatRoom, Message } from '../types/chat';
import { storageService } from '../lib/storage-service';

interface ChatState {
  chatRooms: ChatRoom[];
  activeChatRoom: string | null;
  currentTranscript: string;
  isRecording: boolean;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  addChatRoom: (chatRoom: ChatRoom) => Promise<void>;
  setActiveChatRoom: (chatRoomId: string) => Promise<void>;
  addMessage: (chatRoomId: string, message: Message) => Promise<void>;
  updateMessage: (chatRoomId: string, messageId: string, updater: (msg: Message) => Message) => Promise<void>;
  updateTranscript: (transcript: string) => void;
  setRecording: (recording: boolean) => void;
  deleteChatRoom: (chatRoomId: string) => Promise<void>;
  renameChatRoom: (chatRoomId: string, newName: string) => Promise<void>;
  clearTranscript: () => void;
  clearError: () => void;
}

// Separate timeout management to prevent memory leaks
class TranscriptDebouncer {
  private timeoutId: NodeJS.Timeout | null = null;
  
  debounce(fn: () => Promise<void>, delay: number) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      fn().catch(error => {
        console.error('Failed to persist transcript:', error);
      });
    }, delay);
  }
  
  clear() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

const transcriptDebouncer = new TranscriptDebouncer();

export const useChatStore = create<ChatState>((set, get) => ({
  chatRooms: [],
  activeChatRoom: null,
  currentTranscript: '',
  isRecording: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  initialize: async () => {
    const { isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // Load data from storage service (with automatic fallback)
      const chatRooms = await storageService.getAllChatRooms();
      const activeChatRoom = await storageService.getSetting<string | null>('activeChatRoom', null);
      const currentTranscript = await storageService.getSetting<string>('currentTranscript', '');
      const isRecording = await storageService.getSetting<boolean>('isRecording', false);

      set({
        chatRooms,
        activeChatRoom,
        currentTranscript,
        isRecording,
        isLoading: false,
        error: null
      });

      console.log(`Chat store initialized with ${chatRooms.length} chat rooms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize chat store';
      console.error('Failed to initialize chat store:', error);
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  addChatRoom: async (chatRoom) => {
    // Clear any previous errors
    set({ error: null });
    
    // Update memory state immediately for UI responsiveness
    set((state) => ({ 
      chatRooms: [chatRoom, ...state.chatRooms] 
    }));

    try {
      // Persist to storage
      await storageService.saveChatRoom(chatRoom);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save chat room';
      console.error('Failed to persist chat room:', error);
      
      // Revert on error with proper error state
      set((state) => ({
        chatRooms: state.chatRooms.filter(room => room.id !== chatRoom.id),
        error: errorMessage
      }));
      throw error;
    }
  },

  setActiveChatRoom: async (chatRoomId) => {
    // Update memory state
    set((state) => {
      const updatedChatRooms = state.chatRooms.map(room => 
        room.id === chatRoomId 
          ? { ...room, isActive: true }
          : { ...room, isActive: false }
      );
      return { activeChatRoom: chatRoomId, chatRooms: updatedChatRooms };
    });

    try {
      // Persist active chat room selection
      await storageService.setSetting('activeChatRoom', chatRoomId);
      
      // Update the specific chat room in storage
      const { chatRooms } = get();
      const updatedRoom = chatRooms.find(room => room.id === chatRoomId);
      if (updatedRoom) {
        await storageService.saveChatRoom(updatedRoom);
      }
    } catch (error) {
      console.error('Failed to persist active chat room:', error);
    }
  },

  addMessage: async (chatRoomId, message) => {
    // Update memory state immediately
    set((state) => {
      const updatedChatRooms = state.chatRooms.map(room => 
        room.id === chatRoomId 
          ? { ...room, messages: [...room.messages, message], lastMessageAt: new Date() }
          : room
      );
      return { chatRooms: updatedChatRooms };
    });

    try {
      // Persist message to storage
      await storageService.addMessage(chatRoomId, message);
    } catch (error) {
      console.error('Failed to persist message:', error);
      // Revert on error
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

  updateMessage: async (chatRoomId, messageId, updater) => {
    // Update memory state immediately
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
      return { chatRooms: updatedChatRooms };
    });

    try {
      // Get updated message and persist to storage
      const { chatRooms } = get();
      const chatRoom = chatRooms.find(room => room.id === chatRoomId);
      const updatedMessage = chatRoom?.messages.find(msg => msg.id === messageId);
      
      if (updatedMessage) {
        await storageService.updateMessage(chatRoomId, updatedMessage);
      }
    } catch (error) {
      console.error('Failed to persist message update:', error);
      // Note: We don't revert here as it's harder to track the previous state
      // The user will see the change in UI even if persistence fails
    }
  },

  updateTranscript: (transcript) => {
    set({ currentTranscript: transcript, error: null });
    
    // Use proper debounced persistence
    transcriptDebouncer.debounce(async () => {
      await storageService.setSetting('currentTranscript', transcript);
    }, 1000);
  },

  setRecording: (recording) => {
    set({ isRecording: recording });
    
    // Persist recording state
    storageService.setSetting('isRecording', recording).catch(error => {
      console.error('Failed to persist recording state:', error);
    });
  },

  deleteChatRoom: async (chatRoomId) => {
    // Update memory state
    set((state) => ({
      chatRooms: state.chatRooms.filter(room => room.id !== chatRoomId),
      activeChatRoom: state.activeChatRoom === chatRoomId ? null : state.activeChatRoom
    }));

    try {
      // Remove from storage
      await storageService.deleteChatRoom(chatRoomId);
      
      // Update active chat room setting if needed
      const { activeChatRoom } = get();
      if (!activeChatRoom) {
        await storageService.setSetting('activeChatRoom', null);
      }
    } catch (error) {
      console.error('Failed to delete chat room from storage:', error);
      throw error;
    }
  },

  renameChatRoom: async (chatRoomId, newName) => {
    const oldName = get().chatRooms.find(room => room.id === chatRoomId)?.name;
    
    // Update memory state
    set((state) => ({
      chatRooms: state.chatRooms.map(room => 
        room.id === chatRoomId ? { ...room, name: newName } : room
      )
    }));

    try {
      // Update in storage
      const { chatRooms } = get();
      const updatedRoom = chatRooms.find(room => room.id === chatRoomId);
      if (updatedRoom) {
        await storageService.saveChatRoom(updatedRoom);
      }
    } catch (error) {
      console.error('Failed to rename chat room in storage:', error);
      // Revert on error
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

  clearTranscript: () => {
    set({ currentTranscript: '', error: null });
    
    // Clear debouncer and storage
    transcriptDebouncer.clear();
    storageService.setSetting('currentTranscript', '').catch(error => {
      console.error('Failed to clear transcript from storage:', error);
      set({ error: 'Failed to clear transcript from storage' });
    });
  }
}));