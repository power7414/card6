# IndexedDB Storage System

This directory contains a comprehensive IndexedDB storage implementation for the chat application, providing better performance, larger storage capacity, and robust data management compared to localStorage.

## Overview

The IndexedDB storage system includes:

- **Database Schema**: Well-defined object stores with proper indexing
- **Type-Safe APIs**: Full TypeScript support with type-safe operations
- **Migration System**: Automatic migration from localStorage to IndexedDB
- **Error Handling**: Comprehensive error handling with automatic fallbacks
- **Performance Optimization**: Efficient queries and data management

## Architecture

```
src/lib/indexeddb/
├── schema.ts           # Database schema and configuration
├── database.ts         # Core database connection and management
├── storage-api.ts      # Type-safe storage APIs for different data types
├── migration.ts        # Migration utilities from localStorage
├── index.ts           # Main exports and initialization
├── usage-examples.ts  # Usage examples and demonstrations
└── README.md          # This documentation
```

## Key Features

### 1. Database Schema

The system uses a well-structured schema with the following object stores:

- **`chatRooms`**: Chat room metadata (without messages for performance)
- **`messages`**: Individual messages linked to chat rooms
- **`settings`**: Application settings and user preferences
- **`transcriptions`**: Audio transcription data
- **`metadata`**: System metadata and versioning

### 2. Type-Safe APIs

Each data type has its own dedicated API:

```typescript
import { chatRoomStorage, messageStorage, settingsStorage } from './lib/indexeddb';

// Chat rooms
const rooms = await chatRoomStorage.getAllChatRooms();
await chatRoomStorage.saveChatRoom(newRoom);

// Messages
await messageStorage.addMessage(roomId, message);
const messages = await messageStorage.getMessages(roomId);

// Settings
await settingsStorage.setSetting('theme', 'dark');
const theme = await settingsStorage.getSetting<string>('theme');
```

### 3. Automatic Migration

The system automatically migrates existing localStorage data:

```typescript
import { initializeStorage } from './lib/indexeddb';

const result = await initializeStorage({
  autoMigrate: true,
  clearLocalStorageAfterMigration: false
});

console.log('Migration performed:', result.migrationPerformed);
```

### 4. Unified Storage Service

The `StorageService` provides a unified interface with automatic fallbacks:

```typescript
import { storageService } from './lib/storage-service';

// Automatically uses IndexedDB, falls back to localStorage, then memory
const rooms = await storageService.getAllChatRooms();
await storageService.saveChatRoom(room);
```

## Usage

### Basic Setup

1. **Initialize the storage system** (typically in App.tsx):

```typescript
import { initializeStorage } from './lib/indexeddb';

useEffect(() => {
  const init = async () => {
    const result = await initializeStorage({
      autoMigrate: true,
      clearLocalStorageAfterMigration: false
    });
    
    if (result.initialized) {
      console.log('Storage ready');
    }
  };
  
  init();
}, []);
```

2. **Use the storage APIs** in your components or hooks:

```typescript
import { chatRoomStorage } from './lib/indexeddb';

const saveChatRoom = async (room: ChatRoom) => {
  try {
    await chatRoomStorage.saveChatRoom(room);
  } catch (error) {
    console.error('Failed to save:', error);
  }
};
```

### Advanced Usage

#### Using the Storage Service (Recommended)

The storage service provides the most robust approach with automatic fallbacks:

```typescript
import { storageService } from './lib/storage-service';

// Get storage health
const health = await storageService.getHealth();
console.log('Active storage:', health.activeStorage);

// Use unified API
const rooms = await storageService.getAllChatRooms();
await storageService.setSetting('theme', 'dark');
```

#### Direct API Usage

For more control, use the direct APIs:

```typescript
import { chatRoomStorage, messageStorage, settingsStorage } from './lib/indexeddb';

// Load all data
const [rooms, messages, settings] = await Promise.all([
  chatRoomStorage.getAllChatRooms(),
  messageStorage.getMessages(roomId),
  settingsStorage.getAllSettings()
]);
```

#### Migration Management

```typescript
import { dataMigrator } from './lib/indexeddb';

// Check migration status
const status = await dataMigrator.getMigrationStatus();
console.log('Migration needed:', status.migrationNeeded);

// Perform migration
if (status.migrationNeeded) {
  const result = await dataMigrator.migrateAll();
  console.log('Migrated items:', result.overall.migratedItems);
}
```

## Error Handling

The system includes comprehensive error handling:

### Automatic Fallbacks

1. **IndexedDB** → **localStorage** → **Memory**
2. Each level is tried automatically if the previous fails
3. Operations continue even if storage fails

### Error Recovery

```typescript
try {
  await chatRoomStorage.saveChatRoom(room);
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database error:', error.message);
    // The system will automatically fall back to localStorage
  }
}
```

### Storage Health Monitoring

```typescript
import { getStorageInfo } from './lib/indexeddb';

const info = await getStorageInfo();
console.log('IndexedDB connected:', info.isIndexedDBConnected);
console.log('Storage quota:', info.estimatedQuota);
```

## Performance Optimization

### Efficient Queries

- Messages are stored separately from chat rooms for better performance
- Proper indexing on frequently queried fields
- Cursor-based operations for large datasets

### Debounced Operations

- Transcript updates are debounced to avoid excessive writes
- Background sync operations are batched

### Memory Management

- Large datasets are paginated
- Unused data is garbage collected
- Memory fallback for critical operations

## Data Structure

### Chat Rooms

```typescript
interface ChatRoom {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  messages: Message[];  // Loaded separately for performance
  config?: any;
  isActive: boolean;
}
```

### Messages

```typescript
interface Message {
  id: string;
  chatRoomId: string;  // Foreign key to chat room
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  transcription?: string;
  // ... other fields
}
```

### Settings

```typescript
interface Setting {
  key: string;
  value: any;
  timestamp: Date;
  version?: number;
}
```

## Migration Strategy

### From localStorage

The migration system handles:

1. **Chat Rooms**: `localStorage['chatRooms']` → IndexedDB `chatRooms` + `messages`
2. **Settings**: Various localStorage keys → IndexedDB `settings`
3. **Transcriptions**: `localStorage['transcription_*']` → IndexedDB `transcriptions`

### Data Integrity

- All operations are transactional
- Rollback on errors
- Data validation during migration
- Backup creation before migration

## Troubleshooting

### Common Issues

1. **IndexedDB Not Available**
   - System automatically falls back to localStorage
   - Check browser compatibility

2. **Migration Fails**
   - Original data is preserved
   - Detailed error logging
   - Manual migration tools available

3. **Storage Quota Exceeded**
   - Monitor usage with `getStorageInfo()`
   - Implement data cleanup strategies
   - Use pagination for large datasets

### Debug Tools

```typescript
import { runAllExamples, clearTestData } from './lib/indexeddb/usage-examples';

// Run comprehensive tests
await runAllExamples();

// Clean up test data
await clearTestData();
```

### Logging

Enable detailed logging:

```typescript
import { StorageService } from './lib/storage-service';

const service = new StorageService({
  enableLogging: true,
  enableIndexedDB: true,
  enableLocalStorageFallback: true
});
```

## Best Practices

1. **Always handle errors** - Storage operations can fail
2. **Use the StorageService** - Provides automatic fallbacks
3. **Initialize early** - Set up storage before using other components
4. **Monitor health** - Check storage status periodically
5. **Batch operations** - Group related operations for better performance
6. **Clean up data** - Remove unnecessary data to manage storage quota

## Browser Support

- **IndexedDB**: All modern browsers (IE 10+, Chrome 24+, Firefox 16+, Safari 7+)
- **localStorage fallback**: Universal support
- **Memory fallback**: Always available

## Security Considerations

- Data is stored locally on the user's device
- No automatic encryption (consider implementing if needed)
- Cross-origin isolation follows browser security policies
- Sensitive data should be handled carefully

## Future Enhancements

- [ ] Data compression for large datasets
- [ ] Encryption for sensitive data
- [ ] Cross-tab synchronization
- [ ] Background sync with remote servers
- [ ] Advanced query capabilities
- [ ] Real-time collaboration features