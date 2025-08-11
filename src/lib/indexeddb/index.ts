/**
 * IndexedDB Module - Main exports
 * 
 * This file provides a clean public API for the IndexedDB storage system.
 */

// Core database and utilities
export { dbManager, DatabaseError, requestToPromise, cursorToArray } from './database';

// Storage APIs
export {
  ChatRoomStorageAPI,
  MessageStorageAPI,
  SettingsStorageAPI,
  TranscriptionStorageAPI,
  chatRoomStorage,
  messageStorage,
  settingsStorage,
  transcriptionStorage
} from './storage-api';

// Migration utilities
export { DataMigrator, dataMigrator } from './migration';

// Schema and configuration
export { DB_NAME, DB_VERSION, STORES, INDEXES, STORAGE_KEYS } from './schema';

// Types
export type { StorageOptions } from './storage-api';
export type { MigrationResult, MigrationOptions } from './migration';

/**
 * Initialize the IndexedDB system and perform migration if needed
 */
export async function initializeStorage(options: {
  autoMigrate?: boolean;
  clearLocalStorageAfterMigration?: boolean;
} = {}): Promise<{
  initialized: boolean;
  migrationPerformed: boolean;
  error?: string;
}> {
  const { autoMigrate = true, clearLocalStorageAfterMigration = false } = options;
  const { dbManager } = await import('./database');
  const { dataMigrator } = await import('./migration');
  
  try {
    // Check if IndexedDB is supported
    if (!dbManager.isIndexedDBSupported()) {
      console.warn('IndexedDB not supported, falling back to localStorage');
      return {
        initialized: false,
        migrationPerformed: false,
        error: 'IndexedDB not supported'
      };
    }

    // Initialize database connection
    await dbManager.getDatabase();
    console.log('IndexedDB initialized successfully');

    let migrationPerformed = false;

    // Perform migration if requested and needed
    if (autoMigrate) {
      const migrationNeeded = await dataMigrator.isMigrationNeeded();
      
      if (migrationNeeded) {
        console.log('Starting automatic migration...');
        const { DataMigrator } = await import('./migration');
        const migrator = new DataMigrator({ 
          clearLocalStorageAfterMigration 
        });
        
        const migrationResult = await migrator.migrateAll();
        migrationPerformed = migrationResult.overall.success;
        
        if (migrationResult.overall.success) {
          console.log(`Migration completed successfully. Migrated ${migrationResult.overall.migratedItems} items.`);
        } else {
          console.error('Migration completed with errors:', migrationResult.overall.errors);
        }
      }
    }

    return {
      initialized: true,
      migrationPerformed,
    };
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    return {
      initialized: false,
      migrationPerformed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get storage statistics and health information
 */
export async function getStorageInfo(): Promise<{
  isIndexedDBSupported: boolean;
  isIndexedDBConnected: boolean;
  chatRoomCount: number;
  settingsCount: number;
  migrationStatus: {
    localStorageItems: number;
    indexedDBItems: number;
    migrationNeeded: boolean;
    localStorageSize: number;
  };
  estimatedQuota?: {
    quota: number;
    usage: number;
    available: number;
  };
}> {
  const { dbManager } = await import('./database');
  const { dataMigrator } = await import('./migration');
  const { chatRoomStorage, settingsStorage } = await import('./storage-api');
  
  const info = {
    isIndexedDBSupported: dbManager.isIndexedDBSupported(),
    isIndexedDBConnected: false,
    chatRoomCount: 0,
    settingsCount: 0,
    migrationStatus: await dataMigrator.getMigrationStatus(),
    estimatedQuota: undefined as any
  };

  try {
    // Test IndexedDB connection
    await dbManager.getDatabase();
    info.isIndexedDBConnected = true;

    // Get data counts
    const chatRooms = await chatRoomStorage.getAllChatRooms();
    info.chatRoomCount = chatRooms.length;

    const settings = await settingsStorage.getAllSettings();
    info.settingsCount = Object.keys(settings).length;

    // Get storage quota information if available
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage) {
        info.estimatedQuota = {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage
        };
      }
    }
  } catch (error) {
    console.error('Error getting storage info:', error);
  }

  return info;
}