import React from 'react';
import { ChatItem } from './ChatItem';
import { useChatManager } from '../../hooks/use-chat-manager';

export const ChatList: React.FC = () => {
  const { chatRooms, activeChatRoom, switchChatRoom, deleteChatRoomWithConfirm, renameChatRoomWithPrompt } = useChatManager();

  if (chatRooms.length === 0) {
    return (
      <div className="chat-list-empty">
        <p>尚無聊天室</p>
        <p>點擊「新對話」開始</p>
      </div>
    );
  }

  // 按最後活動時間排序
  const sortedChatRooms = [...chatRooms].sort((a, b) => 
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return (
    <div className="chat-list">
      {sortedChatRooms.map((chatRoom) => (
        <ChatItem
          key={chatRoom.id}
          chatRoom={chatRoom}
          isActive={chatRoom.id === activeChatRoom}
          onClick={() => switchChatRoom(chatRoom.id)}
          onDelete={() => deleteChatRoomWithConfirm(chatRoom.id)}
          onRename={() => renameChatRoomWithPrompt(chatRoom.id)}
        />
      ))}
    </div>
  );
};