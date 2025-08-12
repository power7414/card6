# Console Sidebar

A comprehensive console sidebar component that integrates logging functionality with the Live API conversation system.

## Features

- **Real-time Log Display**: Shows Live API logs with syntax highlighting
- **Advanced Filtering**: Filter logs by type (all, conversations, tools, errors, system)
- **Search Functionality**: Search through logs with real-time filtering
- **Chat Room Integration**: Logs are associated with the current active chat room
- **Message Input**: Send messages directly from the console
- **Collapsible Interface**: Can be collapsed to save space
- **Connection Status**: Shows real-time connection status to Live API
- **Responsive Design**: Adapts to different screen sizes

## Usage

### Basic Usage

```tsx
import { ConsoleSidebar } from './components/console-sidebar';

function App() {
  return (
    <div className="app">
      <ConsoleSidebar />
    </div>
  );
}
```

### With Custom Props

```tsx
<ConsoleSidebar
  defaultOpen={true}
  width="450px"
  className="custom-console"
/>
```

### In Two-Column Layout

```tsx
import { TwoColumnLayout } from './components/layout/TwoColumnLayout';
import { ConsoleSidebar } from './components/console-sidebar';

function App() {
  return (
    <TwoColumnLayout
      leftPanel={<LeftSidebar />}
    >
      <div className="main-content">
        <MainContent />
        <ConsoleSidebar />
      </div>
    </TwoColumnLayout>
  );
}
```

## Props

### ConsoleSidebar Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes |
| `defaultOpen` | `boolean` | `true` | Whether sidebar is open by default |
| `width` | `string` | `'400px'` | Width when expanded |

### Logger Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filter` | `LoggerFilterType` | `'all'` | Log filter type |
| `searchTerm` | `string` | `''` | Search term for filtering |
| `activeChatRoomId` | `string` | `undefined` | Current chat room ID |
| `maxLogs` | `number` | `100` | Maximum number of logs to display |

## Filter Types

- **all**: Show all logs
- **conversations**: Show conversation-related logs only
- **tools**: Show tool call and function response logs
- **errors**: Show error logs only
- **system**: Show system-level logs

## Dependencies

This component requires the following to be available:

### Context Providers
- `LiveAPIProvider`: For Live API connection and client
- Chat store: For chat room management

### Hooks
- `useLiveAPIContext`: Access to Live API client and connection status
- `useChatManager`: Access to chat room management
- `useConversation`: Access to conversation utilities
- `useLoggerStore`: Access to log storage

### External Libraries
- `react-icons/ri`: For sidebar toggle icons
- `react-icons/fi`: For filter and search icons
- `@google/genai`: For Live API types

## Styling

The component uses SCSS modules with CSS custom properties for theming. The main stylesheet is `console-sidebar.scss`.

### CSS Custom Properties Used

- `--bg-primary`: Primary background color
- `--bg-secondary`: Secondary background color
- `--bg-tertiary`: Tertiary background color
- `--text-primary`: Primary text color
- `--text-secondary`: Secondary text color
- `--text-tertiary`: Tertiary text color
- `--accent-color`: Accent color for interactive elements
- `--success-color`: Success state color
- `--error-color`: Error state color
- `--warning-color`: Warning state color
- `--border-color`: Border color
- `--transition`: Standard transition timing

## Integration

The ConsoleSidebar automatically integrates with:

1. **Live API Client**: Listens for log events from the Live API client
2. **Chat Store**: Associates logs with the current active chat room
3. **Logger Store**: Uses the global logger store for log management
4. **Conversation Hook**: Provides message sending capabilities

## Mobile Responsiveness

- On tablets and below, the sidebar becomes full-width when opened
- Font sizes and spacing are adjusted for mobile devices
- Touch-friendly input elements with proper sizing

## Accessibility

- Proper ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly markup
- High contrast color scheme

## Performance

- Logs are limited to configurable maximum (default 100)
- Virtual scrolling for large log lists
- Efficient filtering and searching with useMemo
- Optimized re-renders with React.memo