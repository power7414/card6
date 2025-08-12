/**
 * 簡化的 Session Debug Logger
 * 
 * 提供簡單的除錯日誌功能，預設關閉，需要時可開啟
 */

interface SessionDebugInfo {
  timestamp: Date;
  event: string;
  chatRoomId?: string | null;
  sessionHandle?: string | null;
  details?: any;
}

class SimpleSessionDebugLogger {
  private enabled: boolean = false;
  private logs: SessionDebugInfo[] = [];
  private maxLogs = 50; // 只保留最近 50 筆記錄

  // 啟用或停用 debug logging
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      console.log('🔍 Session Debug 已啟用');
    } else {
      console.log('🔍 Session Debug 已停用');
    }
  }

  // 記錄事件
  log(event: string, data: Partial<SessionDebugInfo> = {}) {
    if (!this.enabled) return;

    const debugInfo: SessionDebugInfo = {
      timestamp: new Date(),
      event,
      chatRoomId: data.chatRoomId,
      sessionHandle: data.sessionHandle ? `${data.sessionHandle.substring(0, 12)}...` : null,
      details: data.details,
      ...data
    };

    this.logs.push(debugInfo);
    
    // 保持記錄數量限制
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 輸出到 console
    const icon = this.getEventIcon(event);
    console.log(
      `${icon} [${event}] ${debugInfo.chatRoomId || 'no-room'}`,
      debugInfo.details || ''
    );
  }

  // 取得事件圖標
  private getEventIcon(event: string): string {
    const icons: Record<string, string> = {
      'session_resumption_update': '📝',
      'connect_start': '🔌',
      'connect_success': '✅',
      'connect_error': '❌',
      'session_handle_stored': '💾',
      'session_handle_retrieved': '🔄',
      'session_handle_check': '🔍',
      'chat_room_switch': '🔄',
      'waiting_for_handle': '⏳',
      'handle_timeout': '⏰'
    };
    return icons[event] || '📋';
  }

  // 取得最近的日誌
  getLogs(): SessionDebugInfo[] {
    return [...this.logs];
  }

  // 清除日誌
  clearLogs() {
    this.logs = [];
    console.log('🧹 Session Debug 日誌已清除');
  }

  // 取得簡單的報告
  getReport(): string {
    if (this.logs.length === 0) {
      return '沒有日誌記錄';
    }

    let report = '=== Session Debug 報告 ===\n\n';
    report += `總共 ${this.logs.length} 筆記錄\n\n`;

    this.logs.slice(-20).forEach(log => {
      const time = log.timestamp.toLocaleTimeString();
      const room = log.chatRoomId || 'no-room';
      const handle = log.sessionHandle || 'no-handle';
      report += `[${time}] ${log.event} - Room: ${room}, Handle: ${handle}\n`;
    });

    return report;
  }
}

// 建立單例
export const sessionDebugLogger = new SimpleSessionDebugLogger();

// 提供全域存取（方便在 console 中使用）
if (typeof window !== 'undefined') {
  (window as any).sessionDebug = {
    enable: () => sessionDebugLogger.setEnabled(true),
    disable: () => sessionDebugLogger.setEnabled(false),
    getLogs: () => sessionDebugLogger.getLogs(),
    getReport: () => console.log(sessionDebugLogger.getReport()),
    clear: () => sessionDebugLogger.clearLogs()
  };
  
  console.log('💡 Session Debug 工具已載入。使用 sessionDebug.enable() 來啟用除錯');
}