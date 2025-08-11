import React from 'react';
import { FiTool, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';
import { useChatManager } from '../../hooks/use-chat-manager';

export const ToolCallViewer: React.FC = () => {
  const { getActiveChatRoom } = useChatManager();
  const activeChatRoom = getActiveChatRoom();

  // 從當前聊天室的訊息中提取工具呼叫
  // 注意：目前 Message 介面還沒有 toolCalls 屬性，這裡暫時返回空陣列
  const toolCalls = React.useMemo((): any[] => {
    if (!activeChatRoom) return [];

    // TODO: 當整合 Live API 時，需要實現工具呼叫的處理
    return [];
  }, [activeChatRoom]);

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (result: any) => {
    if (!result) return <FiClock className="pending" />;
    if (result.error) return <FiXCircle className="error" />;
    return <FiCheckCircle className="success" />;
  };

  if (!activeChatRoom) {
    return (
      <div className="tool-call-viewer">
        <div className="tool-calls-empty">
          <p>請選擇一個聊天室查看工具呼叫</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-call-viewer">
      <div className="tool-calls-header">
        <h3>工具呼叫記錄</h3>
        <span className="tool-count">{toolCalls.length} 次呼叫</span>
      </div>

      <div className="tool-calls-list">
        {toolCalls.length === 0 ? (
          <div className="tool-calls-empty">
            <p>工具呼叫功能將在整合 Live API 時實現</p>
          </div>
        ) : (
          toolCalls.map((toolCall) => (
            <div key={toolCall.id} className="tool-call-item">
              <div className="tool-call-header">
                <div className="tool-info">
                  <FiTool />
                  <span className="tool-name">{toolCall.name}</span>
                </div>
                
                <div className="tool-status">
                  {getStatusIcon(toolCall.result)}
                  <span className="tool-time">
                    {formatTime(toolCall.timestamp)}
                  </span>
                </div>
              </div>

              <div className="tool-call-content">
                {toolCall.args && (
                  <div className="tool-args">
                    <div className="section-title">參數：</div>
                    <pre className="code-block">
                      {JSON.stringify(toolCall.args, null, 2)}
                    </pre>
                  </div>
                )}

                {toolCall.result && (
                  <div className="tool-result">
                    <div className="section-title">
                      {toolCall.result.error ? '錯誤：' : '結果：'}
                    </div>
                    <pre className={`code-block ${toolCall.result.error ? 'error' : ''}`}>
                      {JSON.stringify(toolCall.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};