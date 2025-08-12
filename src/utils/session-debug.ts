/**
 * Session Resumption Debugging Utilities
 * 
 * Comprehensive debugging tools for diagnosing session resumption issues
 */

import { usePersistentChatStore } from '../stores/chat-store-persistent';

interface SessionDebugInfo {
  timestamp: Date;
  chatRoomId: string | null;
  connectingChatRoomId: string | null;
  event: string;
  sessionHandle?: string | null;
  resumable?: boolean;
  hadSessionHandle?: boolean;
  retryConnection?: boolean;
  errorMessage?: string;
  storeState: {
    totalChatRooms: number;
    activeChatRoom: string | null;
    isInitialized: boolean;
    lastSyncedAt: Date | null;
  };
  indexedDBState?: any;
}

class SessionDebugLogger {
  private logs: SessionDebugInfo[] = [];
  private maxLogs = 100;

  log(event: string, data: Partial<SessionDebugInfo> = {}) {
    const store = usePersistentChatStore.getState();
    
    const debugInfo: SessionDebugInfo = {
      timestamp: new Date(),
      event,
      chatRoomId: data.chatRoomId || null,
      connectingChatRoomId: data.connectingChatRoomId || null,
      sessionHandle: data.sessionHandle,
      resumable: data.resumable,
      storeState: {
        totalChatRooms: store.chatRooms.length,
        activeChatRoom: store.activeChatRoom,
        isInitialized: store.isInitialized,
        lastSyncedAt: store.lastSyncedAt
      },
      indexedDBState: data.indexedDBState,
      ...data
    };

    this.logs.push(debugInfo);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Enhanced console output
    const prefix = this.getEventPrefix(event);
    const handleInfo = debugInfo.sessionHandle 
      ? `handle: ${debugInfo.sessionHandle.substring(0, 12)}...` 
      : 'no handle';
    
    console.log(`${prefix} [${event}] Room: ${debugInfo.chatRoomId || 'null'}, ${handleInfo}`, {
      ...debugInfo,
      sessionHandle: debugInfo.sessionHandle ? `${debugInfo.sessionHandle.substring(0, 16)}...` : null
    });
  }

  private getEventPrefix(event: string): string {
    const prefixes: Record<string, string> = {
      'session_resumption_update': '📝',
      'connect_start': '🔌',
      'connect_success': '✅',
      'connect_error': '❌',
      'session_handle_stored': '💾',
      'session_handle_retrieved': '🔄',
      'session_handle_expired': '⏰',
      'chat_room_created': '🆕',
      'chat_room_switch': '🔄',
      'store_sync': '🔄'
    };
    return prefixes[event] || '📋';
  }

  getLogs(): SessionDebugInfo[] {
    return [...this.logs];
  }

  getLogsSince(timestamp: Date): SessionDebugInfo[] {
    return this.logs.filter(log => log.timestamp >= timestamp);
  }

  getLogsForChatRoom(chatRoomId: string): SessionDebugInfo[] {
    return this.logs.filter(log => 
      log.chatRoomId === chatRoomId || log.connectingChatRoomId === chatRoomId
    );
  }

  async getDetailedReport(chatRoomId?: string): Promise<string> {
    const store = usePersistentChatStore.getState();
    const relevantLogs = chatRoomId ? this.getLogsForChatRoom(chatRoomId) : this.logs;
    
    let report = '=== Session Resumption Debug Report ===\n\n';
    
    // Current state
    report += '## Current State\n';
    report += `- Total Chat Rooms: ${store.chatRooms.length}\n`;
    report += `- Active Chat Room: ${store.activeChatRoom}\n`;
    report += `- Store Initialized: ${store.isInitialized}\n`;
    report += `- Last Sync: ${store.lastSyncedAt?.toISOString() || 'never'}\n`;
    
    if (chatRoomId) {
      const room = store.chatRooms.find(r => r.id === chatRoomId);
      if (room?.session) {
        report += `\n## Chat Room Session Data (${chatRoomId})\n`;
        report += `- Session Handle: ${room.session.sessionHandle ? `${room.session.sessionHandle.substring(0, 16)}...` : 'none'}\n`;
        report += `- Last Connected: ${room.session.lastConnected?.toISOString() || 'never'}\n`;
        report += `- Is Resumable: ${room.session.isResumable}\n`;
        
        if (room.session.lastConnected) {
          const ageMinutes = (Date.now() - room.session.lastConnected.getTime()) / (1000 * 60);
          report += `- Session Age: ${ageMinutes.toFixed(1)} minutes\n`;
          report += `- Is Expired: ${ageMinutes > 15}\n`;
        }
      } else {
        report += `\n## Chat Room Session Data (${chatRoomId})\n`;
        report += '- No session data found\n';
      }
    }
    
    // Recent events
    report += `\n## Recent Events (${relevantLogs.length} entries)\n`;
    const recentLogs = relevantLogs.slice(-20);
    
    for (const log of recentLogs) {
      const time = log.timestamp.toISOString().substring(11, 23);
      const room = log.chatRoomId || log.connectingChatRoomId || 'null';
      const handle = log.sessionHandle ? `${log.sessionHandle.substring(0, 12)}...` : 'none';
      report += `[${time}] ${log.event} - Room: ${room}, Handle: ${handle}\n`;
    }
    
    // Event statistics
    const eventCounts = relevantLogs.reduce((acc, log) => {
      acc[log.event] = (acc[log.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    report += '\n## Event Statistics\n';
    Object.entries(eventCounts).forEach(([event, count]) => {
      report += `- ${event}: ${count}\n`;
    });
    
    return report;
  }

  clearLogs() {
    this.logs = [];
  }

  async exportLogs(): Promise<Blob> {
    const report = await this.getDetailedReport();
    return new Blob([report], { type: 'text/plain' });
  }
}

export const sessionDebugLogger = new SessionDebugLogger();

// Debug utilities for console usage
(window as any).sessionDebug = {
  getLogs: () => sessionDebugLogger.getLogs(),
  getReport: (chatRoomId?: string) => sessionDebugLogger.getDetailedReport(chatRoomId),
  exportLogs: () => sessionDebugLogger.exportLogs(),
  clearLogs: () => sessionDebugLogger.clearLogs()
};