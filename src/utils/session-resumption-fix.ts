/**
 * Session Resumption Race Condition Fix
 * 
 * This file contains improved session resumption logic to handle race conditions
 * between chat room creation, Live API connection, and session handle storage.
 */

interface QueuedSessionUpdate {
  chatRoomId: string;
  update: {
    resumable: boolean;
    newHandle: string | null;
  };
  timestamp: Date;
  retryCount: number;
}

class SessionResumptionQueue {
  private queue: QueuedSessionUpdate[] = [];
  private processing = false;
  private maxRetries = 5;
  private retryDelay = 100; // Start with 100ms, exponential backoff

  async queueSessionUpdate(chatRoomId: string, update: { resumable: boolean; newHandle: string | null }) {
    console.log('📋 Queueing session update for later processing:', { chatRoomId, update });
    
    // Remove any existing updates for the same chat room
    this.queue = this.queue.filter(item => item.chatRoomId !== chatRoomId);
    
    // Add new update to queue
    this.queue.push({
      chatRoomId,
      update,
      timestamp: new Date(),
      retryCount: 0
    });

    // Process the queue
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    console.log('🔄 Processing session update queue...', { queueSize: this.queue.length });

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        const success = await this.tryProcessSessionUpdate(item);
        
        if (!success && item.retryCount < this.maxRetries) {
          // Exponential backoff retry
          item.retryCount++;
          const delay = this.retryDelay * Math.pow(2, item.retryCount - 1);
          
          console.log(`⏰ Retrying session update in ${delay}ms (attempt ${item.retryCount}/${this.maxRetries})`, {
            chatRoomId: item.chatRoomId
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          this.queue.unshift(item); // Put back at front of queue
        } else if (!success) {
          console.error('❌ Failed to process session update after max retries:', {
            chatRoomId: item.chatRoomId,
            maxRetries: this.maxRetries
          });
        }
      } catch (error) {
        console.error('❌ Error processing session update:', error, { item });
      }
    }

    this.processing = false;
    console.log('✅ Session update queue processing complete');
  }

  private async tryProcessSessionUpdate(item: QueuedSessionUpdate): Promise<boolean> {
    const { chatRoomId, update } = item;
    
    try {
      // Check if chat room exists in the store
      const { usePersistentChatStore } = await import('../stores/chat-store-persistent');
      const store = usePersistentChatStore.getState();
      
      if (!store.isInitialized) {
        console.log('⏳ Store not yet initialized, retrying later...', { chatRoomId });
        return false;
      }

      const chatRoom = store.chatRooms.find(room => room.id === chatRoomId);
      if (!chatRoom) {
        console.log('⏳ Chat room not found, retrying later...', { chatRoomId, totalRooms: store.chatRooms.length });
        return false;
      }

      // Try to get the session resumption hook functionality
      const { useSessionResumption } = await import('../hooks/use-session-resumption');
      
      // Since we can't use hooks outside React components, we need to access the store directly
      // This is a workaround - ideally this would be handled within the React component
      
      if (update.resumable && update.newHandle) {
        // Update the chat room with new session data
        const updatedChatRoom = {
          ...chatRoom,
          session: {
            sessionHandle: update.newHandle,
            lastConnected: new Date(),
            isResumable: true
          }
        };

        const updatedChatRooms = store.chatRooms.map(room => 
          room.id === chatRoomId ? updatedChatRoom : room
        );

        // Update store state atomically
        usePersistentChatStore.setState({ chatRooms: updatedChatRooms });

        // Persist to storage
        await store.syncToStorage();
        
        console.log('✅ Successfully processed queued session update:', {
          chatRoomId,
          handlePreview: update.newHandle.substring(0, 16) + '...'
        });
      } else {
        // Clear session data
        const updatedChatRoom = {
          ...chatRoom,
          session: {
            sessionHandle: null,
            lastConnected: null,
            isResumable: false
          }
        };

        const updatedChatRooms = store.chatRooms.map(room => 
          room.id === chatRoomId ? updatedChatRoom : room
        );

        usePersistentChatStore.setState({ chatRooms: updatedChatRooms });
        await store.syncToStorage();
        
        console.log('✅ Successfully cleared queued session data:', { chatRoomId });
      }

      return true;
    } catch (error) {
      console.error('❌ Error in tryProcessSessionUpdate:', error, { chatRoomId });
      return false;
    }
  }

  getQueueStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      oldestItem: this.queue[0] ? {
        chatRoomId: this.queue[0].chatRoomId,
        timestamp: this.queue[0].timestamp,
        retryCount: this.queue[0].retryCount
      } : null
    };
  }

  clearQueue() {
    this.queue = [];
    this.processing = false;
  }
}

export const sessionResumptionQueue = new SessionResumptionQueue();

// Add to global scope for debugging
(window as any).sessionQueue = {
  getStatus: () => sessionResumptionQueue.getQueueStatus(),
  clearQueue: () => sessionResumptionQueue.clearQueue()
};