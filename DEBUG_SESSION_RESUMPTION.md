# Session Resumption Debugging Guide

This guide helps diagnose and fix session resumption issues in the Google Gemini Live API integration.

## Quick Diagnosis

Open your browser's developer console and run:

```javascript
// Run comprehensive diagnostics
await sessionDiagnostics.runDiagnostics();

// Get a detailed report
console.log(sessionDiagnostics.getReport());
```

## Step-by-Step Debugging

### 1. Check Current Session State

```javascript
// Check session debug logs
sessionDebug.getReport();

// Check specific chat room session
sessionDebug.getReport('your-chat-room-id');

// Export logs for analysis
const logs = await sessionDebug.exportLogs();
// Save the blob to analyze session patterns
```

### 2. Verify IndexedDB Data

```javascript
// Check if sessions are being stored
const store = window.usePersistentChatStore.getState();
console.log('Chat rooms with sessions:', store.chatRooms.filter(room => room.session?.sessionHandle));

// Check queue status (if race conditions suspected)
sessionQueue.getStatus();
```

### 3. Common Issues and Solutions

#### Issue: "⚠️ 沒有可用的 chatRoomId，忽略 session 更新"

**Symptom**: Session resumption updates are being ignored due to missing chat room ID.

**Root Cause**: Race condition where `session_resumption_update` events arrive before the chat room is properly created/set.

**Check**: 
```javascript
// Look for ignored session updates in logs
sessionDebug.getLogs().filter(log => log.event === 'session_resumption_ignored');
```

**Solution**: The improved code now queues these updates for later processing.

#### Issue: Session handles not persisting

**Symptom**: Session handles are received but not found on reconnection.

**Possible Causes**:
1. IndexedDB synchronization issues
2. Session expiration (15 minutes)
3. Store initialization problems

**Check**:
```javascript
// Run storage integrity check
await sessionDiagnostics.runDiagnostics();

// Check specific room session data
const roomId = 'your-chat-room-id';
const room = store.chatRooms.find(r => r.id === roomId);
console.log('Session data:', room?.session);
```

#### Issue: Sessions expiring too quickly

**Symptom**: Session handles are cleared despite recent usage.

**Check**:
```javascript
// Check session ages
store.chatRooms.forEach(room => {
  if (room.session?.lastConnected) {
    const ageMinutes = (Date.now() - room.session.lastConnected.getTime()) / (1000 * 60);
    console.log(`Room ${room.name}: ${ageMinutes.toFixed(1)} minutes old`);
  }
});
```

### 4. Enable Enhanced Logging

The improved code includes comprehensive logging. To see all session-related logs:

```javascript
// Enable verbose session logging
localStorage.setItem('sessionDebugVerbose', 'true');

// Then refresh the page and try connecting to a chat room
// Check console for detailed session flow logging
```

### 5. Test Session Flow

```javascript
// Test the complete session flow
async function testSessionFlow() {
  console.log('=== Testing Session Resumption Flow ===');
  
  // 1. Connect to a chat room
  const chatRoomId = 'test-room-' + Date.now();
  // Use your UI to create and connect to a chat room
  
  // 2. Wait for session data
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 3. Check if session was stored
  const room = store.chatRooms.find(r => r.id === chatRoomId);
  console.log('Session stored:', !!room?.session?.sessionHandle);
  
  // 4. Disconnect and reconnect
  // Use your UI to disconnect and reconnect
  
  // 5. Check if session was resumed
  console.log('Session resume attempted');
}
```

## Troubleshooting Checklist

- [ ] **Store Initialized**: `store.isInitialized === true`
- [ ] **No Sync Errors**: `store.syncError === null`
- [ ] **IndexedDB Accessible**: Can read/write to IndexedDB
- [ ] **Chat Room Exists**: Target chat room is in `store.chatRooms`
- [ ] **Session Data Valid**: Has `sessionHandle`, `lastConnected`, `isResumable: true`
- [ ] **Session Not Expired**: Age < 15 minutes
- [ ] **Event Timing**: No race conditions in event sequence

## Recovery Actions

### Clear All Session Data (Nuclear Option)

```javascript
// WARNING: This clears all session data
async function clearAllSessions() {
  const store = window.usePersistentChatStore.getState();
  const clearedRooms = store.chatRooms.map(room => ({
    ...room,
    session: { sessionHandle: null, lastConnected: null, isResumable: false }
  }));
  
  window.usePersistentChatStore.setState({ chatRooms: clearedRooms });
  await store.syncToStorage();
  
  console.log('All session data cleared');
}
```

### Force Store Sync

```javascript
// Force synchronization between memory and storage
async function forceSyncStore() {
  const store = window.usePersistentChatStore.getState();
  await store.syncFromStorage(); // Load from IndexedDB
  await store.syncToStorage();   // Save to IndexedDB
  console.log('Store sync completed');
}
```

### Reset Session Queue

```javascript
// Clear any queued session updates
sessionQueue.clearQueue();
console.log('Session queue cleared');
```

## Performance Monitoring

```javascript
// Monitor session operation performance
const perfMonitor = {
  start: Date.now(),
  checkpoints: [],
  
  checkpoint(name) {
    this.checkpoints.push({ name, time: Date.now() - this.start });
  },
  
  report() {
    console.table(this.checkpoints);
  }
};

// Use during session operations
perfMonitor.checkpoint('Connection started');
// ... perform operations ...
perfMonitor.checkpoint('Session update received');
perfMonitor.checkpoint('Session stored');
perfMonitor.report();
```

## Reporting Issues

When reporting session resumption issues, please include:

1. **Diagnostic Report**: Output from `sessionDiagnostics.getReport()`
2. **Session Logs**: Output from `sessionDebug.getReport()`
3. **Browser/Device**: Chrome/Firefox version, OS
4. **Reproduction Steps**: Exact steps that cause the issue
5. **Console Errors**: Any error messages from developer console

## Getting Help

If the above steps don't resolve the issue:

1. Run the full diagnostic suite
2. Export the logs and diagnostic report
3. Create an issue with the collected information
4. Include screenshots of the console output if helpful

The enhanced logging and diagnostic tools should help identify the root cause of session resumption failures.