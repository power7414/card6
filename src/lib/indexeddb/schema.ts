/**
 * IndexedDB Database Schema and Configuration
 * 
 * This file defines the structure and versioning for our IndexedDB database.
 * It includes object stores for chat rooms, messages, settings, and transcriptions.
 */

export const DB_NAME = 'ChatAppDB';
export const DB_VERSION = 1;

// Object Store Names
export const STORES = {
  CHAT_ROOMS: 'chatRooms',
  MESSAGES: 'messages',
  SETTINGS: 'settings', 
  TRANSCRIPTIONS: 'transcriptions',
  METADATA: 'metadata'
} as const;

// Index Names
export const INDEXES = {
  CHAT_ROOMS: {
    BY_CREATED_AT: 'byCreatedAt',
    BY_LAST_MESSAGE_AT: 'byLastMessageAt',
    BY_ACTIVE: 'byActive'
  },
  MESSAGES: {
    BY_CHAT_ROOM_ID: 'byChatRoomId',
    BY_TIMESTAMP: 'byTimestamp',
    BY_TYPE: 'byType'
  },
  TRANSCRIPTIONS: {
    BY_CHAT_ROOM_ID: 'byChatRoomId',
    BY_TIMESTAMP: 'byTimestamp'
  }
} as const;

// Database Schema Configuration
export interface DBSchema {
  [STORES.CHAT_ROOMS]: {
    key: string; // ChatRoom.id
    value: {
      id: string;
      name: string;
      createdAt: Date;
      lastMessageAt: Date;
      config?: any;
      isActive: boolean;
      // Note: messages are stored separately for better performance
    };
    indexes: {
      [INDEXES.CHAT_ROOMS.BY_CREATED_AT]: Date;
      [INDEXES.CHAT_ROOMS.BY_LAST_MESSAGE_AT]: Date;
      [INDEXES.CHAT_ROOMS.BY_ACTIVE]: boolean;
    };
  };
  
  [STORES.MESSAGES]: {
    key: string; // Message.id
    value: {
      id: string;
      chatRoomId: string;
      type: 'user' | 'assistant';
      content: string;
      timestamp: Date;
      audioUrl?: string;
      isTranscribing?: boolean;
      transcription?: string;
      realtimeTranscription?: {
        currentText: string;
        isFinal: boolean;
        isProcessing: boolean;
      };
    };
    indexes: {
      [INDEXES.MESSAGES.BY_CHAT_ROOM_ID]: string;
      [INDEXES.MESSAGES.BY_TIMESTAMP]: Date;
      [INDEXES.MESSAGES.BY_TYPE]: 'user' | 'assistant';
    };
  };
  
  [STORES.SETTINGS]: {
    key: string; // Setting key
    value: {
      key: string;
      value: any;
      timestamp: Date;
      version?: number;
    };
  };
  
  [STORES.TRANSCRIPTIONS]: {
    key: string; // Unique transcription ID
    value: {
      id: string;
      chatRoomId: string;
      content: string;
      timestamp: Date;
      isActive: boolean;
      isFinal: boolean;
    };
    indexes: {
      [INDEXES.TRANSCRIPTIONS.BY_CHAT_ROOM_ID]: string;
      [INDEXES.TRANSCRIPTIONS.BY_TIMESTAMP]: Date;
    };
  };
  
  [STORES.METADATA]: {
    key: string; // Metadata key
    value: {
      key: string;
      value: any;
      timestamp: Date;
    };
  };
}

/**
 * Database upgrade function that handles schema creation and migrations
 */
export function upgradeDatabase(db: IDBDatabase, oldVersion: number, newVersion: number | null): void {
  console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
  
  // Version 1: Initial schema
  if (oldVersion < 1) {
    createInitialSchema(db);
  }
  
  // Future versions can be handled here
  // if (oldVersion < 2) {
  //   upgradeToVersion2(db);
  // }
}

/**
 * Creates the initial database schema
 */
function createInitialSchema(db: IDBDatabase): void {
  // Chat Rooms Store
  if (!db.objectStoreNames.contains(STORES.CHAT_ROOMS)) {
    const chatRoomsStore = db.createObjectStore(STORES.CHAT_ROOMS, { keyPath: 'id' });
    chatRoomsStore.createIndex(INDEXES.CHAT_ROOMS.BY_CREATED_AT, 'createdAt');
    chatRoomsStore.createIndex(INDEXES.CHAT_ROOMS.BY_LAST_MESSAGE_AT, 'lastMessageAt');
    chatRoomsStore.createIndex(INDEXES.CHAT_ROOMS.BY_ACTIVE, 'isActive');
  }
  
  // Messages Store
  if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
    const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
    messagesStore.createIndex(INDEXES.MESSAGES.BY_CHAT_ROOM_ID, 'chatRoomId');
    messagesStore.createIndex(INDEXES.MESSAGES.BY_TIMESTAMP, 'timestamp');
    messagesStore.createIndex(INDEXES.MESSAGES.BY_TYPE, 'type');
  }
  
  // Settings Store
  if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
  }
  
  // Transcriptions Store
  if (!db.objectStoreNames.contains(STORES.TRANSCRIPTIONS)) {
    const transcriptionsStore = db.createObjectStore(STORES.TRANSCRIPTIONS, { keyPath: 'id' });
    transcriptionsStore.createIndex(INDEXES.TRANSCRIPTIONS.BY_CHAT_ROOM_ID, 'chatRoomId');
    transcriptionsStore.createIndex(INDEXES.TRANSCRIPTIONS.BY_TIMESTAMP, 'timestamp');
  }
  
  // Metadata Store
  if (!db.objectStoreNames.contains(STORES.METADATA)) {
    db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
  }
}

// Storage Keys for different data types
export const STORAGE_KEYS = {
  PANEL_STATE: 'panelState',
  CONSOLE_SIDEBAR_STATE: 'consoleSidebarState',
  UI_PREFERENCES: 'uiPreferences',
  AUDIO_SETTINGS: 'audioSettings',
  TRANSCRIPTION_SETTINGS: 'transcriptionSettings'
} as const;