/**
 * Migration utilities for moving data from localStorage to IndexedDB
 * 
 * This file handles the migration of existing localStorage data to IndexedDB,
 * ensuring backward compatibility and data integrity during the transition.
 */

import { ChatRoom, Message } from '../../types/chat';
import { chatRoomStorage, settingsStorage, transcriptionStorage } from './storage-api';
import { STORAGE_KEYS } from './schema';

export interface MigrationResult {
  success: boolean;
  migratedItems: number;
  errors: string[];
  skippedItems: number;
}

export interface MigrationOptions {
  clearLocalStorageAfterMigration?: boolean;
  skipExistingData?: boolean;
  backupLocalStorage?: boolean;
}

const DEFAULT_MIGRATION_OPTIONS: Required<MigrationOptions> = {
  clearLocalStorageAfterMigration: false,
  skipExistingData: true,
  backupLocalStorage: true
};

/**
 * Main migration coordinator
 */
export class DataMigrator {
  private options: Required<MigrationOptions>;

  constructor(options: MigrationOptions = {}) {
    this.options = { ...DEFAULT_MIGRATION_OPTIONS, ...options };
  }

  /**
   * Migrate all data from localStorage to IndexedDB
   */
  async migrateAll(): Promise<{
    chatRooms: MigrationResult;
    settings: MigrationResult;
    transcriptions: MigrationResult;
    overall: MigrationResult;
  }> {
    console.log('Starting full data migration from localStorage to IndexedDB...');

    // Create backup if requested
    if (this.options.backupLocalStorage) {
      await this.createLocalStorageBackup();
    }

    const results = {
      chatRooms: await this.migrateChatRooms(),
      settings: await this.migrateSettings(),
      transcriptions: await this.migrateTranscriptions(),
      overall: { success: true, migratedItems: 0, errors: [] as string[], skippedItems: 0 }
    };

    // Calculate overall results
    results.overall.migratedItems = results.chatRooms.migratedItems + 
                                   results.settings.migratedItems + 
                                   results.transcriptions.migratedItems;
    
    results.overall.skippedItems = results.chatRooms.skippedItems + 
                                  results.settings.skippedItems + 
                                  results.transcriptions.skippedItems;
    
    results.overall.errors = [
      ...results.chatRooms.errors,
      ...results.settings.errors,
      ...results.transcriptions.errors
    ];

    results.overall.success = results.chatRooms.success && 
                             results.settings.success && 
                             results.transcriptions.success;

    // Clear localStorage if requested and migration was successful
    if (this.options.clearLocalStorageAfterMigration && results.overall.success) {
      await this.clearMigratedLocalStorageData();
    }

    console.log('Migration completed:', results.overall);
    return results;
  }

  /**
   * Migrate chat rooms and messages from localStorage
   */
  async migrateChatRooms(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedItems: 0,
      errors: [],
      skippedItems: 0
    };

    try {
      const chatRoomsData = localStorage.getItem('chatRooms');
      if (!chatRoomsData) {
        console.log('No chat rooms found in localStorage');
        return result;
      }

      const chatRooms: any[] = JSON.parse(chatRoomsData);
      console.log(`Found ${chatRooms.length} chat rooms to migrate`);

      // Check if we should skip existing data
      if (this.options.skipExistingData) {
        const existingRooms = await chatRoomStorage.getAllChatRooms();
        if (existingRooms.length > 0) {
          console.log(`Skipping chat room migration - ${existingRooms.length} rooms already exist in IndexedDB`);
          result.skippedItems = chatRooms.length;
          return result;
        }
      }

      for (const roomData of chatRooms) {
        try {
          // Transform localStorage data to proper format
          const chatRoom: ChatRoom = {
            id: roomData.id,
            name: roomData.name,
            createdAt: new Date(roomData.createdAt),
            lastMessageAt: new Date(roomData.lastMessageAt),
            config: roomData.config,
            isActive: roomData.isActive || false,
            messages: (roomData.messages || []).map((msgData: any): Message => ({
              id: msgData.id,
              type: msgData.type,
              content: msgData.content,
              timestamp: new Date(msgData.timestamp),
              audioUrl: msgData.audioUrl,
              isTranscribing: msgData.isTranscribing,
              transcription: msgData.transcription,
              realtimeTranscription: msgData.realtimeTranscription
            }))
          };

          await chatRoomStorage.saveChatRoom(chatRoom);
          result.migratedItems++;
          console.log(`Migrated chat room: ${chatRoom.name} (${chatRoom.messages.length} messages)`);
        } catch (error) {
          const errorMsg = `Failed to migrate chat room ${roomData.id}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to migrate chat rooms: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  /**
   * Migrate settings from localStorage
   */
  async migrateSettings(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedItems: 0,
      errors: [],
      skippedItems: 0
    };

    try {
      // Known settings keys to migrate
      const settingsKeys = [
        STORAGE_KEYS.PANEL_STATE,
        STORAGE_KEYS.CONSOLE_SIDEBAR_STATE,
        STORAGE_KEYS.UI_PREFERENCES,
        STORAGE_KEYS.AUDIO_SETTINGS,
        STORAGE_KEYS.TRANSCRIPTION_SETTINGS
      ];

      for (const key of settingsKeys) {
        try {
          const value = localStorage.getItem(key);
          if (value !== null) {
            // Check if setting already exists in IndexedDB
            if (this.options.skipExistingData) {
              const existing = await settingsStorage.getSetting(key);
              if (existing !== undefined) {
                console.log(`Skipping setting ${key} - already exists in IndexedDB`);
                result.skippedItems++;
                continue;
              }
            }

            // Parse JSON if possible, otherwise store as string
            let parsedValue: any;
            try {
              parsedValue = JSON.parse(value);
            } catch {
              parsedValue = value;
            }

            await settingsStorage.setSetting(key, parsedValue);
            result.migratedItems++;
            console.log(`Migrated setting: ${key}`);
          }
        } catch (error) {
          const errorMsg = `Failed to migrate setting ${key}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Also migrate any other localStorage items that look like settings
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !(settingsKeys as string[]).includes(key) && !key.startsWith('transcription_') && key !== 'chatRooms') {
          try {
            if (this.options.skipExistingData) {
              const existing = await settingsStorage.getSetting(key);
              if (existing !== undefined) {
                result.skippedItems++;
                continue;
              }
            }

            const value = localStorage.getItem(key);
            if (value !== null) {
              let parsedValue: any;
              try {
                parsedValue = JSON.parse(value);
              } catch {
                parsedValue = value;
              }

              await settingsStorage.setSetting(key, parsedValue);
              result.migratedItems++;
              console.log(`Migrated additional setting: ${key}`);
            }
          } catch (error) {
            const errorMsg = `Failed to migrate additional setting ${key}: ${error}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Failed to migrate settings: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  /**
   * Migrate transcriptions from localStorage
   */
  async migrateTranscriptions(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedItems: 0,
      errors: [],
      skippedItems: 0
    };

    try {
      // Find all transcription keys in localStorage
      const transcriptionKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('transcription_')) {
          transcriptionKeys.push(key);
        }
      }

      if (transcriptionKeys.length === 0) {
        console.log('No transcriptions found in localStorage');
        return result;
      }

      console.log(`Found ${transcriptionKeys.length} transcription keys to migrate`);

      for (const key of transcriptionKeys) {
        try {
          const data = localStorage.getItem(key);
          if (!data) continue;

          const transcriptions = JSON.parse(data);
          const chatRoomId = key.replace('transcription_', '');

          // Check if transcriptions already exist for this chat room
          if (this.options.skipExistingData) {
            const existing = await transcriptionStorage.getTranscriptions(chatRoomId);
            if (existing.length > 0) {
              console.log(`Skipping transcriptions for chat room ${chatRoomId} - already exist in IndexedDB`);
              result.skippedItems += transcriptions.length;
              continue;
            }
          }

          for (const transcription of transcriptions) {
            await transcriptionStorage.saveTranscription({
              id: transcription.id,
              chatRoomId,
              content: transcription.content,
              isActive: transcription.isActive || false,
              isFinal: transcription.isFinal || true
            });
            result.migratedItems++;
          }

          console.log(`Migrated ${transcriptions.length} transcriptions for chat room ${chatRoomId}`);
        } catch (error) {
          const errorMsg = `Failed to migrate transcriptions from ${key}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to migrate transcriptions: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  /**
   * Create a backup of localStorage data
   */
  private async createLocalStorageBackup(): Promise<void> {
    try {
      const backup: Record<string, string> = {};
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            backup[key] = value;
          }
        }
      }

      const backupKey = `localStorage_backup_${new Date().toISOString()}`;
      const backupData = JSON.stringify(backup);
      
      // Store backup in IndexedDB
      await settingsStorage.setSetting(backupKey, backup);
      console.log(`Created localStorage backup: ${backupKey}`);
    } catch (error) {
      console.error('Failed to create localStorage backup:', error);
    }
  }

  /**
   * Clear migrated localStorage data
   */
  private async clearMigratedLocalStorageData(): Promise<void> {
    try {
      const keysToRemove = [
        'chatRooms',
        STORAGE_KEYS.PANEL_STATE,
        STORAGE_KEYS.CONSOLE_SIDEBAR_STATE,
        STORAGE_KEYS.UI_PREFERENCES,
        STORAGE_KEYS.AUDIO_SETTINGS,
        STORAGE_KEYS.TRANSCRIPTION_SETTINGS
      ];

      // Remove transcription keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('transcription_')) {
          keysToRemove.push(key);
        }
      }

      // Remove all identified keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`Removed localStorage key: ${key}`);
      });

      console.log(`Cleared ${keysToRemove.length} localStorage keys after successful migration`);
    } catch (error) {
      console.error('Failed to clear localStorage data after migration:', error);
    }
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded(): Promise<boolean> {
    try {
      // Check if there's any relevant data in localStorage
      const hasLocalStorageData = localStorage.getItem('chatRooms') !== null ||
                                 localStorage.getItem(STORAGE_KEYS.PANEL_STATE) !== null ||
                                 localStorage.getItem(STORAGE_KEYS.CONSOLE_SIDEBAR_STATE) !== null;
      
      if (!hasLocalStorageData) {
        return false;
      }

      // Check if IndexedDB already has data
      const existingRooms = await chatRoomStorage.getAllChatRooms();
      const existingSettings = await settingsStorage.getAllSettings();
      
      // Migration is needed if localStorage has data but IndexedDB is empty
      return existingRooms.length === 0 && Object.keys(existingSettings).length === 0;
    } catch (error) {
      console.error('Error checking if migration is needed:', error);
      return false;
    }
  }

  /**
   * Get migration status information
   */
  async getMigrationStatus(): Promise<{
    localStorageItems: number;
    indexedDBItems: number;
    migrationNeeded: boolean;
    localStorageSize: number;
  }> {
    try {
      // Count localStorage items
      let localStorageItems = 0;
      let localStorageSize = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            localStorageItems++;
            localStorageSize += key.length + value.length;
          }
        }
      }

      // Count IndexedDB items
      const chatRooms = await chatRoomStorage.getAllChatRooms();
      const settings = await settingsStorage.getAllSettings();
      const indexedDBItems = chatRooms.length + Object.keys(settings).length;

      const migrationNeeded = await this.isMigrationNeeded();

      return {
        localStorageItems,
        indexedDBItems,
        migrationNeeded,
        localStorageSize
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        localStorageItems: 0,
        indexedDBItems: 0,
        migrationNeeded: false,
        localStorageSize: 0
      };
    }
  }
}

// Export singleton instance
export const dataMigrator = new DataMigrator();