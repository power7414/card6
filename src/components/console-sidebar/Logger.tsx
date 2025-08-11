import React, { memo, ReactNode, useMemo } from 'react';
import { useLoggerStore } from '../../lib/store-logger';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { LoggerProps, LoggerFilterType, EnhancedStreamingLog, LogFilterFunction, LogSearchFunction } from './types';
import { StreamingLog } from '../../types';
import {
  Content,
  LiveClientToolResponse,
  LiveServerContent,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
} from '@google/genai';

const formatTime = (d: Date) => d.toLocaleTimeString().slice(0, -3);

// Log entry component
const LogEntry = memo(
  ({
    log,
    MessageComponent,
  }: {
    log: EnhancedStreamingLog;
    MessageComponent: ({
      message,
    }: {
      message: StreamingLog['message'];
    }) => ReactNode;
  }): JSX.Element => (
    <li
      className={`log-entry source-${log.type.slice(0, log.type.indexOf('.'))} ${
        log.type.includes('receive') ? 'receive' : ''
      } ${log.type.includes('send') ? 'send' : ''} ${log.level ? `level-${log.level}` : ''}`}
    >
      <span className="timestamp">{formatTime(log.date)}</span>
      <span className="source">{log.type}</span>
      <span className="message">
        <MessageComponent message={log.message} />
      </span>
      {log.count && <span className="count">{log.count}</span>}
    </li>
  )
);

// Message component types
const PlainTextMessage = ({
  message,
}: {
  message: StreamingLog['message'];
}) => <span>{message as string}</span>;

type Message = { message: StreamingLog['message'] };

const AnyMessage = ({ message }: Message) => (
  <pre>{JSON.stringify(message, null, '  ')}</pre>
);

function tryParseCodeExecutionResult(output: string) {
  try {
    const json = JSON.parse(output);
    return JSON.stringify(json, null, '  ');
  } catch (e) {
    return output;
  }
}

const RenderPart = memo(({ part }: { part: Part }) => {
  if (part.text && part.text.length) {
    return <p className="part part-text">{part.text}</p>;
  }
  if (part.executableCode) {
    return (
      <div className="part part-executableCode">
        <h5>executableCode: {part.executableCode.language}</h5>
        <SyntaxHighlighter
          language={part.executableCode!.language!.toLowerCase()}
        >
          {part.executableCode!.code!}
        </SyntaxHighlighter>
      </div>
    );
  }
  if (part.codeExecutionResult) {
    return (
      <div className="part part-codeExecutionResult">
        <h5>codeExecutionResult: {part.codeExecutionResult!.outcome}</h5>
        <SyntaxHighlighter language="json">
          {tryParseCodeExecutionResult(part.codeExecutionResult!.output!)}
        </SyntaxHighlighter>
      </div>
    );
  }
  if (part.inlineData) {
    return (
      <div className="part part-inlinedata">
        <h5>Inline Data: {part.inlineData?.mimeType}</h5>
      </div>
    );
  }
  return <div className="part part-unknown">&nbsp;</div>;
});

const ClientContentLog = memo(({ message }: Message) => {
  const { turns, turnComplete } = message as any;
  const textParts = turns.filter((part: Part) => !(part.text && part.text === '\n'));
  return (
    <div className="rich-log client-content user">
      <h4 className="role-user">User</h4>
      <div key={`message-turn`}>
        {textParts.map((part: Part, j: number) => (
          <RenderPart part={part} key={`message-part-${j}`} />
        ))}
      </div>
      {!turnComplete ? <span>turnComplete: false</span> : ''}
    </div>
  );
});

const ToolCallLog = memo(({ message }: Message) => {
  const { toolCall } = message as { toolCall: LiveServerToolCall };
  return (
    <div className="rich-log tool-call">
      {toolCall.functionCalls?.map((fc, i) => (
        <div key={fc.id} className="part part-functioncall">
          <h5>Function call: {fc.name}</h5>
          <SyntaxHighlighter language="json">
            {JSON.stringify(fc, null, '  ')}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  );
});

const ToolCallCancellationLog = ({ message }: Message): JSX.Element => (
  <div className="rich-log tool-call-cancellation">
    <span>
      {' '}
      ids:{' '}
      {(
        message as { toolCallCancellation: LiveServerToolCallCancellation }
      ).toolCallCancellation.ids?.map((id) => (
        <span className="inline-code" key={`cancel-${id}`}>
          "{id}"
        </span>
      ))}
    </span>
  </div>
);

const ToolResponseLog = memo(
  ({ message }: Message): JSX.Element => (
    <div className="rich-log tool-response">
      {(message as LiveClientToolResponse).functionResponses?.map((fc) => (
        <div key={`tool-response-${fc.id}`} className="part">
          <h5>Function Response: {fc.id}</h5>
          <SyntaxHighlighter language="json">
            {JSON.stringify(fc.response, null, '  ')}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  )
);

const ModelTurnLog = ({ message }: Message): JSX.Element => {
  const serverContent = (message as { serverContent: LiveServerContent })
    .serverContent;
  const { modelTurn } = serverContent as { modelTurn: Content };
  const { parts } = modelTurn;

  return (
    <div className="rich-log model-turn model">
      <h4 className="role-model">Model</h4>
      {parts
        ?.filter((part) => !(part.text && part.text === '\n'))
        .map((part, j) => (
          <RenderPart part={part} key={`model-turn-part-${j}`} />
        ))}
    </div>
  );
};

const CustomPlainTextLog = (msg: string) => () =>
  <PlainTextMessage message={msg} />;

// Filter functions
const filters: Record<LoggerFilterType, LogFilterFunction> = {
  tools: (log: EnhancedStreamingLog) =>
    typeof log.message === 'object' &&
    ('toolCall' in log.message ||
      'functionResponses' in log.message ||
      'toolCallCancellation' in log.message),
  conversations: (log: EnhancedStreamingLog) =>
    typeof log.message === 'object' &&
    (('turns' in log.message && 'turnComplete' in log.message) ||
      'serverContent' in log.message),
  errors: (log: EnhancedStreamingLog) =>
    log.level === 'error' || log.type.toLowerCase().includes('error'),
  system: (log: EnhancedStreamingLog) =>
    log.category === 'system' || log.type.toLowerCase().includes('system'),
  all: () => true,
};

// Search function
const searchLogs: LogSearchFunction = (log: EnhancedStreamingLog, searchTerm: string) => {
  if (!searchTerm.trim()) return true;
  
  const term = searchTerm.toLowerCase();
  const logType = log.type.toLowerCase();
  const messageStr = typeof log.message === 'string'
    ? log.message.toLowerCase()
    : JSON.stringify(log.message).toLowerCase();
  
  return logType.includes(term) || messageStr.includes(term);
};

// Component selector
const getMessageComponent = (log: StreamingLog) => {
  if (typeof log.message === 'string') {
    return PlainTextMessage;
  }
  if ('turns' in log.message && 'turnComplete' in log.message) {
    return ClientContentLog;
  }
  if ('toolCall' in log.message) {
    return ToolCallLog;
  }
  if ('toolCallCancellation' in log.message) {
    return ToolCallCancellationLog;
  }
  if ('functionResponses' in log.message) {
    return ToolResponseLog;
  }
  if ('serverContent' in log.message) {
    const { serverContent } = log.message;
    if (serverContent?.interrupted) {
      return CustomPlainTextLog('interrupted');
    }
    if (serverContent?.turnComplete) {
      return CustomPlainTextLog('turnComplete');
    }
    if (serverContent && 'modelTurn' in serverContent) {
      return ModelTurnLog;
    }
  }
  return AnyMessage;
};

// Main Logger component
export const Logger: React.FC<LoggerProps> = ({ 
  filter = 'all', 
  searchTerm = '', 
  activeChatRoomId,
  maxLogs = 100 
}) => {
  const { logs } = useLoggerStore();

  // Enhanced logs with additional metadata
  const enhancedLogs: EnhancedStreamingLog[] = useMemo(() => {
    return logs.map(log => ({
      ...log,
      chatRoomId: activeChatRoomId, // Associate with current chat room
      level: getLogLevel(log),
      category: getLogCategory(log)
    }));
  }, [logs, activeChatRoomId]);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    const filterFn = filters[filter];
    return enhancedLogs
      .filter(filterFn)
      .filter(log => searchLogs(log, searchTerm))
      .slice(-maxLogs); // Limit to max logs for performance
  }, [enhancedLogs, filter, searchTerm, maxLogs]);

  if (filteredLogs.length === 0) {
    return (
      <div className="logger">
        <div className="logger-empty">
          <p>No logs to display</p>
          {searchTerm && <p>Try adjusting your search term</p>}
          {filter !== 'all' && <p>Try changing the filter</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="logger">
      <ul className="logger-list">
        {filteredLogs.map((log, key) => {
          return (
            <LogEntry
              MessageComponent={getMessageComponent(log)}
              log={log}
              key={`${log.date.getTime()}-${key}`}
            />
          );
        })}
      </ul>
    </div>
  );
};

// Helper functions
function getLogLevel(log: StreamingLog): 'info' | 'warn' | 'error' | 'debug' {
  const type = log.type.toLowerCase();
  if (type.includes('error')) return 'error';
  if (type.includes('warn')) return 'warn';
  if (type.includes('debug')) return 'debug';
  return 'info';
}

function getLogCategory(log: StreamingLog): 'conversation' | 'tool' | 'system' | 'error' {
  const type = log.type.toLowerCase();
  if (type.includes('error')) return 'error';
  if (type.includes('tool') || type.includes('function')) return 'tool';
  if (type.includes('system') || type.includes('server') || type.includes('client')) return 'system';
  return 'conversation';
}

export default Logger;