/**
 * Session Resumption Diagnostic Tools
 * 
 * Run these diagnostics to identify session resumption issues
 */

import { usePersistentChatStore } from '../stores/chat-store-persistent';
import { chatRoomStorage, settingsStorage } from '../lib/indexeddb';

interface DiagnosticResult {
  category: string;
  test: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

class SessionDiagnostics {
  private results: DiagnosticResult[] = [];

  private addResult(category: string, test: string, status: DiagnosticResult['status'], message: string, details?: any) {
    this.results.push({ category, test, status, message, details });
    
    const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} [${category}] ${test}: ${message}`, details || '');
  }

  async runAllDiagnostics(): Promise<DiagnosticResult[]> {
    console.log('🔍 Running Session Resumption Diagnostics...\n');
    this.results = [];

    await this.checkStoreInitialization();
    await this.checkIndexedDBIntegrity();
    await this.checkChatRoomSessions();
    await this.checkTimingIssues();
    await this.checkEventSequencing();
    
    return this.results;
  }

  private async checkStoreInitialization() {
    const category = 'Store Initialization';
    
    try {
      const store = usePersistentChatStore.getState();
      
      this.addResult(
        category,
        'Store Initialized',
        store.isInitialized ? 'pass' : 'fail',
        store.isInitialized ? 'Store is properly initialized' : 'Store not initialized',
        { isInitialized: store.isInitialized, lastSyncedAt: store.lastSyncedAt }
      );

      this.addResult(
        category,
        'Chat Rooms Loaded',
        store.chatRooms.length > 0 ? 'pass' : 'warn',
        `${store.chatRooms.length} chat rooms loaded`,
        { totalRooms: store.chatRooms.length, activeChatRoom: store.activeChatRoom }
      );

      if (store.syncError) {
        this.addResult(
          category,
          'Sync Errors',
          'fail',
          `Sync error detected: ${store.syncError}`,
          { syncError: store.syncError }
        );
      } else {
        this.addResult(category, 'Sync Status', 'pass', 'No sync errors detected');
      }

    } catch (error) {
      this.addResult(
        category,
        'Store Access',
        'fail',
        `Failed to access store: ${error}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  private async checkIndexedDBIntegrity() {
    const category = 'IndexedDB Integrity';
    
    try {
      // Check if we can read from IndexedDB
      const chatRooms = await chatRoomStorage.getAllChatRooms();
      const activeChatRoomSetting = await settingsStorage.getSetting('activeChatRoom', null);
      
      this.addResult(
        category,
        'IndexedDB Access',
        'pass',
        'IndexedDB is accessible',
        { chatRoomsCount: chatRooms.length, activeChatRoom: activeChatRoomSetting }
      );

      // Check data consistency between store and IndexedDB
      const storeRooms = usePersistentChatStore.getState().chatRooms;
      const storeActive = usePersistentChatStore.getState().activeChatRoom;
      
      if (chatRooms.length !== storeRooms.length) {
        this.addResult(
          category,
          'Data Consistency',
          'warn',
          `Mismatch between IndexedDB (${chatRooms.length}) and store (${storeRooms.length}) room counts`,
          { indexedDBCount: chatRooms.length, storeCount: storeRooms.length }
        );
      } else {
        this.addResult(category, 'Data Consistency', 'pass', 'Room counts match between IndexedDB and store');
      }

      if (activeChatRoomSetting !== storeActive) {
        this.addResult(
          category,
          'Active Room Sync',
          'warn',
          `Active room mismatch: IndexedDB (${activeChatRoomSetting}) vs Store (${storeActive})`,
          { indexedDBActive: activeChatRoomSetting, storeActive }
        );
      } else {
        this.addResult(category, 'Active Room Sync', 'pass', 'Active room synchronized');
      }

    } catch (error) {
      this.addResult(
        category,
        'IndexedDB Access',
        'fail',
        `Failed to access IndexedDB: ${error}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  private async checkChatRoomSessions() {
    const category = 'Chat Room Sessions';
    
    try {
      const store = usePersistentChatStore.getState();
      const roomsWithSessions = store.chatRooms.filter(room => room.session?.sessionHandle);
      
      this.addResult(
        category,
        'Rooms with Sessions',
        roomsWithSessions.length > 0 ? 'pass' : 'warn',
        `${roomsWithSessions.length} out of ${store.chatRooms.length} rooms have session data`
      );

      for (const room of roomsWithSessions) {
        if (!room.session) continue;
        
        const sessionAge = room.session.lastConnected 
          ? Date.now() - room.session.lastConnected.getTime()
          : null;
        
        const isExpired = sessionAge ? sessionAge > (15 * 60 * 1000) : true;
        const ageMinutes = sessionAge ? (sessionAge / (1000 * 60)).toFixed(1) : 'unknown';

        this.addResult(
          category,
          `Session ${room.name}`,
          isExpired ? 'warn' : 'pass',
          `Session ${isExpired ? 'expired' : 'valid'} (age: ${ageMinutes} min)`,
          {
            roomId: room.id,
            sessionHandle: room.session.sessionHandle?.substring(0, 16) + '...',
            lastConnected: room.session.lastConnected?.toISOString(),
            isResumable: room.session.isResumable,
            ageMinutes,
            isExpired
          }
        );
      }

      // Check for orphaned sessions (rooms without valid session data structure)
      const roomsWithBrokenSessions = store.chatRooms.filter(room => 
        room.session && (!room.session.sessionHandle || !room.session.lastConnected)
      );

      if (roomsWithBrokenSessions.length > 0) {
        this.addResult(
          category,
          'Broken Sessions',
          'warn',
          `${roomsWithBrokenSessions.length} rooms have incomplete session data`,
          roomsWithBrokenSessions.map(room => ({
            roomId: room.id,
            name: room.name,
            hasHandle: !!room.session?.sessionHandle,
            hasLastConnected: !!room.session?.lastConnected,
            isResumable: room.session?.isResumable
          }))
        );
      }

    } catch (error) {
      this.addResult(
        category,
        'Session Analysis',
        'fail',
        `Failed to analyze sessions: ${error}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  private async checkTimingIssues() {
    const category = 'Timing & Race Conditions';
    
    // Simulate rapid operations to check for race conditions
    try {
      const testRoom = {
        id: 'diagnostic-test-room',
        name: 'Diagnostic Test',
        createdAt: new Date(),
        lastMessageAt: new Date(),
        messages: [],
        isActive: false
      };

      // Test rapid store operations
      const startTime = Date.now();
      
      await usePersistentChatStore.getState().addChatRoom(testRoom);
      await new Promise(resolve => setTimeout(resolve, 50));
      await usePersistentChatStore.getState().setActiveChatRoom(testRoom.id);
      
      const endTime = Date.now();
      const operationTime = endTime - startTime;
      
      this.addResult(
        category,
        'Store Operation Speed',
        operationTime < 1000 ? 'pass' : 'warn',
        `Store operations completed in ${operationTime}ms`,
        { operationTimeMs: operationTime }
      );

      // Clean up test room
      await usePersistentChatStore.getState().deleteChatRoom(testRoom.id);

      // Check store synchronization timing
      const syncStartTime = Date.now();
      await usePersistentChatStore.getState().syncFromStorage();
      const syncTime = Date.now() - syncStartTime;
      
      this.addResult(
        category,
        'Storage Sync Speed',
        syncTime < 2000 ? 'pass' : 'warn',
        `Storage sync completed in ${syncTime}ms`,
        { syncTimeMs: syncTime }
      );

    } catch (error) {
      this.addResult(
        category,
        'Timing Test',
        'fail',
        `Timing test failed: ${error}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  private async checkEventSequencing() {
    const category = 'Event Sequencing';
    
    // Check if event listeners are properly set up
    try {
      // This is a basic check - in real scenario, we'd need access to the Live API client
      this.addResult(
        category,
        'Event System',
        'pass',
        'Event system diagnostics would need Live API client access'
      );

      // Check for common race condition patterns in the logs
      if ((window as any).sessionDebug) {
        const logs = (window as any).sessionDebug.getLogs();
        const recentLogs = logs.slice(-50); // Last 50 events
        
        // Look for patterns that indicate race conditions
        const resumptionIgnored = recentLogs.filter((log: any) => log.event === 'session_resumption_ignored');
        const resumptionUpdates = recentLogs.filter((log: any) => log.event === 'session_resumption_update');
        
        if (resumptionIgnored.length > 0) {
          this.addResult(
            category,
            'Session Updates Ignored',
            'warn',
            `${resumptionIgnored.length} session resumption updates were ignored (potential race condition)`,
            { ignoredCount: resumptionIgnored.length, totalUpdates: resumptionUpdates.length }
          );
        } else if (resumptionUpdates.length > 0) {
          this.addResult(
            category,
            'Session Updates',
            'pass',
            `${resumptionUpdates.length} session updates processed successfully`
          );
        }
      }

    } catch (error) {
      this.addResult(
        category,
        'Event Analysis',
        'fail',
        `Event analysis failed: ${error}`,
        { error: error instanceof Error ? error.message : error }
      );
    }
  }

  generateReport(): string {
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const warnCount = this.results.filter(r => r.status === 'warn').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    
    let report = '=== Session Resumption Diagnostic Report ===\n\n';
    report += `Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed\n\n`;
    
    const categories = [...new Set(this.results.map(r => r.category))];
    
    for (const category of categories) {
      report += `## ${category}\n`;
      const categoryResults = this.results.filter(r => r.category === category);
      
      for (const result of categoryResults) {
        const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
        report += `${icon} ${result.test}: ${result.message}\n`;
        
        if (result.details && typeof result.details === 'object') {
          report += `   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n   ')}\n`;
        }
      }
      report += '\n';
    }
    
    return report;
  }
}

export const sessionDiagnostics = new SessionDiagnostics();

// Add to global scope for easy console access
(window as any).sessionDiagnostics = {
  runDiagnostics: () => sessionDiagnostics.runAllDiagnostics(),
  getReport: () => sessionDiagnostics.generateReport()
};