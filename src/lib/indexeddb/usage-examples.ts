/**
 * IndexedDB Storage Usage Examples
 * 
 * This file demonstrates how to use the IndexedDB storage system in various scenarios.
 */

import { ChatRoom, Message } from '../../types/chat';
import { 
  initializeStorage, 
  chatRoomStorage, 
  messageStorage, 
  settingsStorage,
  dataMigrator,
  getStorageInfo
} from './index';
import { storageService } from '../storage-service';

/**
 * Example 1: Basic Setup and Initialization
 */
export async function basicSetupExample(): Promise<void> {
  console.log('=== Basic Setup Example ===');
  
  // Initialize storage with automatic migration
  const result = await initializeStorage({
    autoMigrate: true,
    clearLocalStorageAfterMigration: false
  });
  
  console.log('Storage initialized:', result.initialized);
  console.log('Migration performed:', result.migrationPerformed);
  
  // Get storage information
  const info = await getStorageInfo();
  console.log('Storage info:', info);
}

/**
 * Example 2: Chat Room Operations
 */
export async function chatRoomOperationsExample(): Promise<void> {
  console.log('=== Chat Room Operations Example ===');
  
  // Create a new chat room
  const newChatRoom: ChatRoom = {
    id: 'chat-' + Date.now(),
    name: 'Example Chat Room',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    messages: [],
    isActive: true
  };
  
  // Save the chat room
  await chatRoomStorage.saveChatRoom(newChatRoom);
  console.log('Chat room saved:', newChatRoom.name);
  
  // Add a message to the chat room
  const message: Message = {
    id: 'msg-' + Date.now(),
    type: 'user',
    content: 'Hello, this is a test message!',
    timestamp: new Date()
  };
  
  await messageStorage.addMessage(newChatRoom.id, message);
  console.log('Message added to chat room');
  
  // Retrieve all chat rooms
  const allChatRooms = await chatRoomStorage.getAllChatRooms();
  console.log('Total chat rooms:', allChatRooms.length);
  
  // Retrieve a specific chat room with messages
  const retrievedRoom = await chatRoomStorage.getChatRoom(newChatRoom.id);
  console.log('Retrieved chat room messages:', retrievedRoom?.messages.length);
}

/**
 * Example 3: Settings Management
 */
export async function settingsManagementExample(): Promise<void> {
  console.log('=== Settings Management Example ===');
  
  // Save various types of settings
  await settingsStorage.setSetting('theme', 'dark');
  await settingsStorage.setSetting('autoSave', true);
  await settingsStorage.setSetting('maxChatRooms', 50);
  await settingsStorage.setSetting('userPreferences', {
    notifications: true,
    soundEnabled: false,
    language: 'en'
  });
  
  // Retrieve settings
  const theme = await settingsStorage.getSetting<string>('theme');
  const autoSave = await settingsStorage.getSetting<boolean>('autoSave');
  const userPrefs = await settingsStorage.getSetting<any>('userPreferences');
  
  console.log('Theme:', theme);
  console.log('Auto save:', autoSave);
  console.log('User preferences:', userPrefs);
  
  // Get all settings
  const allSettings = await settingsStorage.getAllSettings();
  console.log('All settings:', Object.keys(allSettings));
}

/**
 * Example 4: Migration and Data Transfer
 */
export async function migrationExample(): Promise<void> {
  console.log('=== Migration Example ===');
  
  // Check if migration is needed
  const migrationNeeded = await dataMigrator.isMigrationNeeded();
  console.log('Migration needed:', migrationNeeded);
  
  // Get migration status
  const status = await dataMigrator.getMigrationStatus();
  console.log('Migration status:', status);
  
  // Perform migration if needed
  if (migrationNeeded) {
    const migrationResult = await dataMigrator.migrateAll();
    console.log('Migration result:', migrationResult.overall);
  }
}

/**
 * Example 5: Using the Unified Storage Service
 */
export async function storageServiceExample(): Promise<void> {
  console.log('=== Storage Service Example ===');
  
  // Get storage health
  const health = await storageService.getHealth();
  console.log('Storage health:', health);
  
  // Create a chat room using the storage service
  const chatRoom: ChatRoom = {
    id: 'service-chat-' + Date.now(),
    name: 'Storage Service Chat',
    createdAt: new Date(),
    lastMessageAt: new Date(),
    messages: [],
    isActive: true
  };
  
  await storageService.saveChatRoom(chatRoom);
  console.log('Chat room saved via storage service');
  
  // Add a message
  const message: Message = {
    id: 'service-msg-' + Date.now(),
    type: 'assistant',
    content: 'This message was saved through the storage service!',
    timestamp: new Date()
  };
  
  await storageService.addMessage(chatRoom.id, message);
  console.log('Message added via storage service');
  
  // Retrieve chat rooms
  const rooms = await storageService.getAllChatRooms();
  console.log('Chat rooms from storage service:', rooms.length);
  
  // Save and retrieve settings
  await storageService.setSetting('lastUsedService', 'storage-service');
  const lastUsed = await storageService.getSetting<string>('lastUsedService');
  console.log('Last used service:', lastUsed);
}

/**
 * Example 6: Error Handling and Fallbacks
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('=== Error Handling Example ===');
  
  try {
    // This might fail if IndexedDB is not available
    await chatRoomStorage.getAllChatRooms();
    console.log('IndexedDB operation successful');
  } catch (error) {
    console.log('IndexedDB failed, using fallback:', error);
    
    // The storage service will automatically fall back to localStorage or memory
    const rooms = await storageService.getAllChatRooms();
    console.log('Fallback successful, got rooms:', rooms.length);
  }
}

/**
 * Example 7: Data Export and Backup
 */
export async function dataExportExample(): Promise<void> {
  console.log('=== Data Export Example ===');
  
  // Export all data
  const exportedData = await storageService.exportData();
  
  console.log('Exported data summary:');
  console.log('- Chat rooms:', exportedData.chatRooms.length);
  console.log('- Settings:', Object.keys(exportedData.settings).length);
  console.log('- Transcriptions:', Object.keys(exportedData.transcriptions).length);
  console.log('- Exported at:', exportedData.exportedAt);
  
  // You could save this to a file or send to a server
  const backupBlob = new Blob([JSON.stringify(exportedData, null, 2)], { 
    type: 'application/json' 
  });
  
  console.log('Backup size:', backupBlob.size, 'bytes');
}

/**
 * Example 8: Performance Monitoring
 */
export async function performanceMonitoringExample(): Promise<void> {
  console.log('=== Performance Monitoring Example ===');
  
  const startTime = performance.now();
  
  // Create multiple chat rooms and messages
  const promises: Promise<void>[] = [];
  
  for (let i = 0; i < 10; i++) {
    const chatRoom: ChatRoom = {
      id: `perf-chat-${i}`,
      name: `Performance Test Chat ${i}`,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
      isActive: i === 0
    };
    
    promises.push(storageService.saveChatRoom(chatRoom));
    
    // Add some messages
    for (let j = 0; j < 5; j++) {
      const message: Message = {
        id: `perf-msg-${i}-${j}`,
        type: j % 2 === 0 ? 'user' : 'assistant',
        content: `Performance test message ${j} in chat ${i}`,
        timestamp: new Date(Date.now() + j * 1000)
      };
      
      promises.push(storageService.addMessage(chatRoom.id, message));
    }
  }
  
  await Promise.all(promises);
  
  const endTime = performance.now();
  console.log(`Performance test completed in ${endTime - startTime}ms`);
  
  // Verify data
  const allRooms = await storageService.getAllChatRooms();
  const totalMessages = allRooms.reduce((sum, room) => sum + room.messages.length, 0);
  
  console.log('Created rooms:', allRooms.length);
  console.log('Total messages:', totalMessages);
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  try {
    await basicSetupExample();
    await chatRoomOperationsExample();
    await settingsManagementExample();
    await migrationExample();
    await storageServiceExample();
    await errorHandlingExample();
    await dataExportExample();
    await performanceMonitoringExample();
    
    console.log('=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Utility function to clear test data
export async function clearTestData(): Promise<void> {
  try {
    const allRooms = await storageService.getAllChatRooms();
    
    for (const room of allRooms) {
      if (room.id.includes('chat-') || room.id.includes('service-chat-') || room.id.includes('perf-chat-')) {
        await storageService.deleteChatRoom(room.id);
      }
    }
    
    // Clean up test settings
    const testSettings = ['theme', 'autoSave', 'maxChatRooms', 'userPreferences', 'lastUsedService'];
    for (const setting of testSettings) {
      await storageService.deleteSetting(setting);
    }
    
    console.log('Test data cleared');
  } catch (error) {
    console.error('Failed to clear test data:', error);
  }
}