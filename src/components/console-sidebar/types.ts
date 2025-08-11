import { StreamingLog } from '../../types';

// Filter types for the logger
export type LoggerFilterType = 'all' | 'conversations' | 'tools' | 'errors' | 'system';

// Enhanced log entry that includes chat room context
export interface EnhancedStreamingLog extends StreamingLog {
  chatRoomId?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  category?: 'conversation' | 'tool' | 'system' | 'error';
}

// Logger component props
export interface LoggerProps {
  filter: LoggerFilterType;
  searchTerm?: string;
  activeChatRoomId?: string;
  maxLogs?: number;
}

// Console sidebar configuration
export interface ConsoleSidebarConfig {
  defaultOpen: boolean;
  width: string;
  maxLogs: number;
  enableSearch: boolean;
  enableFiltering: boolean;
  autoScroll: boolean;
}

// Log filter function type
export type LogFilterFunction = (log: EnhancedStreamingLog) => boolean;

// Search function type
export type LogSearchFunction = (log: EnhancedStreamingLog, searchTerm: string) => boolean;