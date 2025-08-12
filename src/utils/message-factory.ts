/**
 * 共用的訊息創建工廠函數
 * 避免在多個 hooks 中重複相同的邏輯
 */

import { Message } from '../types/chat';

/**
 * 創建訊息的通用函數
 */
export const createMessage = (
  type: 'user' | 'assistant',
  content: string,
  options: Partial<Message> = {}
): Message => {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    content: content.trim(),
    timestamp: new Date(),
    ...options
  };
};

/**
 * 創建用戶訊息
 */
export const createUserMessage = (content: string, options?: Partial<Message>): Message => {
  return createMessage('user', content, options);
};

/**
 * 創建助理訊息
 */
export const createAssistantMessage = (content: string, options?: Partial<Message>): Message => {
  return createMessage('assistant', content, options);
};

// 移除 createSystemMessage，因為 Message 型別不支援 system

/**
 * 創建錯誤訊息
 */
export const createErrorMessage = (error: unknown): Message => {
  const errorContent = error instanceof Error ? error.message : '未知錯誤';
  return createAssistantMessage(`發送失敗: ${errorContent}`);
};