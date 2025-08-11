# Session Resumption for Google Live API

This guide explains how to use the session resumption functionality in the Live API integration, which enables conversations to continue seamlessly across reconnections.

## Overview

Session resumption allows the Google Live API to maintain conversation context when connections are temporarily lost or when switching between chat rooms. This provides a better user experience by avoiding conversation restarts and preserving the AI's understanding of the ongoing dialogue.

## Key Components

### 1. `useSessionResumption` Hook

Located in `/src/hooks/use-session-resumption.ts`, this hook manages session handles for chat rooms.

#### Features:
- **Session Handle Storage**: Stores session handles associated with chat rooms
- **Automatic Expiration**: Manages session timeout (default: 15 minutes)
- **Event Handling**: Processes session resumption updates from the Live API
- **Cleanup**: Automatically removes expired sessions
- **Validation**: Checks session validity before use

#### Usage:
```typescript
import { useSessionResumption } from '../hooks/use-session-resumption';

const sessionResumption = useSessionResumption({
  enableLogging: true,
  autoCleanupExpired: true,
  maxSessionAge: 15 * 60 * 1000 // 15 minutes
});

// Check if a chat room has a valid session
const hasValidSession = sessionResumption.hasValidSession(chatRoomId);

// Store a session handle
await sessionResumption.storeSessionHandle(chatRoomId, sessionHandle);

// Clear a session handle
await sessionResumption.clearSessionHandle(chatRoomId);
```

### 2. Enhanced `useLiveAPI` Hook

The existing Live API hook has been extended with session resumption capabilities.

#### New Methods:
- `connectWithResumption(chatRoomId: string)`: Connect using stored session handle
- `hasValidSession(chatRoomId: string)`: Check if a chat room has a valid session
- `currentChatRoomId`: Track which chat room is currently active

#### Updated Event Handling:
- Automatically handles `session_resumption_update` events
- Stores new session handles when received
- Gracefully falls back to new sessions if resumption fails

### 3. Chat Room Session Data

The `ChatRoom` interface includes session information:

```typescript
interface ChatRoomSession {
  sessionHandle: string | null;
  lastConnected: Date | null;
  isResumable: boolean;
}

interface ChatRoom {
  // ... existing properties
  session?: ChatRoomSession;
}
```

## How It Works

### 1. Initial Connection
```typescript
const liveAPI = useLiveAPI({ apiKey: "your-api-key" });

// Connect with session resumption for a specific chat room
await liveAPI.connectWithResumption("chat-room-id");
```

### 2. Session Handle Management
When the Live API sends a `session_resumption_update` event:
1. The event is captured by the `useLiveAPI` hook
2. The session handle is stored in the chat room's session data
3. The handle is persisted to IndexedDB via the chat store

### 3. Reconnection Process
When `connectWithResumption` is called:
1. Retrieve the stored session handle for the chat room
2. Check if the handle is still valid (not expired)
3. Attempt to connect with the session handle
4. If resumption fails, clear the invalid handle and connect with a new session

### 4. Session Expiration
- Sessions automatically expire after 15 minutes (configurable)
- Expired sessions are cleaned up automatically
- Invalid handles are removed when connection fails

## Integration Examples

### Basic Usage

```typescript
import { useLiveAPI } from '../hooks/use-live-api';
import { usePersistentChatStore } from '../stores/chat-store-persistent';

const ChatComponent = () => {
  const liveAPI = useLiveAPI({ apiKey: process.env.REACT_APP_GEMINI_API_KEY });
  const { activeChatRoom } = usePersistentChatStore();

  const handleConnect = async () => {
    if (activeChatRoom) {
      // This will use session resumption if available
      await liveAPI.connectWithResumption(activeChatRoom);
    }
  };

  const handleDisconnect = async () => {
    await liveAPI.disconnect();
  };

  return (
    <div>
      <button onClick={handleConnect} disabled={liveAPI.connected}>
        Connect {liveAPI.hasValidSession(activeChatRoom) ? '(Resume)' : '(New)'}
      </button>
      <button onClick={handleDisconnect} disabled={!liveAPI.connected}>
        Disconnect
      </button>
    </div>
  );
};
```

### Advanced Usage with Session Management

```typescript
const SessionManager = () => {
  const liveAPI = useLiveAPI({ apiKey: process.env.REACT_APP_GEMINI_API_KEY });
  const sessionResumption = useSessionResumption({ enableLogging: true });
  const { chatRooms } = usePersistentChatStore();

  const getSessionStats = () => {
    const stats = sessionResumption.getSessionStats();
    return {
      total: stats.totalSessions,
      valid: stats.validSessions,
      expired: stats.expiredSessions
    };
  };

  const cleanupExpiredSessions = async () => {
    await sessionResumption.cleanupExpiredSessions();
  };

  return (
    <div>
      <h3>Session Statistics</h3>
      <pre>{JSON.stringify(getSessionStats(), null, 2)}</pre>
      
      <h3>Chat Room Sessions</h3>
      {chatRooms.map(room => (
        <div key={room.id}>
          {room.name}: {liveAPI.hasValidSession(room.id) ? '✓' : '✗'}
        </div>
      ))}
      
      <button onClick={cleanupExpiredSessions}>
        Cleanup Expired Sessions
      </button>
    </div>
  );
};
```

## Configuration Options

### Session Resumption Options
```typescript
interface UseSessionResumptionOptions {
  maxSessionAge?: number;        // Default: 15 minutes
  autoCleanupExpired?: boolean;  // Default: true
  enableLogging?: boolean;       // Default: false
}
```

### Live API Session Timeouts
- **Audio-only sessions**: 15 minutes
- **Audio + Video sessions**: 2 minutes (Google's limitation)

## Error Handling

The session resumption system includes robust error handling:

1. **Invalid Session Handles**: Automatically cleared and new sessions created
2. **Network Failures**: Graceful fallback to regular connection
3. **Storage Errors**: Logged but don't prevent functionality
4. **Expired Sessions**: Automatically detected and cleaned up

## Best Practices

1. **Always use `connectWithResumption`** for chat room connections
2. **Check session validity** before showing connection status
3. **Handle connection failures gracefully** with fallbacks
4. **Enable logging during development** for debugging
5. **Monitor session statistics** for optimal performance
6. **Clean up expired sessions periodically** (automatic by default)

## Debugging

Enable session resumption logging:

```typescript
const sessionResumption = useSessionResumption({
  enableLogging: true
});
```

This will log:
- Session handle storage/retrieval operations
- Session resumption update events
- Session cleanup operations
- Connection attempts with resumption status

## File Structure

```
src/
├── hooks/
│   ├── use-session-resumption.ts    # Session resumption hook
│   └── use-live-api.ts              # Enhanced Live API hook
├── types/
│   └── chat.ts                      # ChatRoomSession interface
├── stores/
│   └── chat-store-persistent.ts     # Chat room persistence
└── components/
    └── session-resumption-demo.tsx  # Example implementation
```

## Testing

A demo component is provided at `/src/components/session-resumption-demo.tsx` that demonstrates:
- Session resumption connection
- Session validity checking
- Session statistics display
- Error handling scenarios

This component can be used for testing and understanding the session resumption functionality.