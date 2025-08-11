/**
 * Integration tests for Chat Room Management Workflow
 * 
 * Tests the complete chat room management flow including:
 * - Creating, switching, renaming, and deleting chat rooms
 * - Message persistence and retrieval
 * - UI interactions and state synchronization
 * - Error handling and recovery scenarios
 * - Storage layer integration
 */

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, waitForAsync } from '../utils/test-helpers';
import { TestDataFactory } from '../utils/test-data-factory';
import { mockIndexedDB } from '../../__mocks__/indexeddb-mock';

// Import components to test
import { ChatSidebar } from '../../components/chat-room-sidebar/ChatSidebar';
import { ConversationArea } from '../../components/conversation-display/ConversationArea';
import { useChatStore } from '../../stores/chat-store';

// Mock the storage service to use our mock IndexedDB
jest.mock('../../lib/storage-service', () => ({
  storageService: {
    getAllChatRooms: () => mockIndexedDB.getAllChatRooms(),
    saveChatRoom: (room: any) => mockIndexedDB.saveChatRoom(room),
    deleteChatRoom: (id: string) => mockIndexedDB.deleteChatRoom(id),
    addMessage: (roomId: string, message: any) => mockIndexedDB.addMessage(roomId, message),
    getSetting: (key: string, defaultValue?: any) => mockIndexedDB.getSetting(key, defaultValue),
    setSetting: (key: string, value: any) => mockIndexedDB.setSetting(key, value)
  }
}));

// Test component that combines chat sidebar and conversation area
const ChatRoomManagementTest: React.FC = () => {
  const { initialize } = useChatStore();
  
  React.useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '300px' }}>
        <ChatSidebar />
      </div>
      <div style={{ flex: 1 }}>
        <ConversationArea />
      </div>
    </div>
  );
};

describe('Chat Room Management Integration', () => {
  beforeEach(async () => {
    // Clear mock storage
    mockIndexedDB.__testUtils.clear();
    await mockIndexedDB.initialize();

    // Reset window functions
    Object.defineProperty(window, 'confirm', {
      value: jest.fn(() => true),
      writable: true
    });
    Object.defineProperty(window, 'prompt', {
      value: jest.fn(() => 'New Room Name'),
      writable: true
    });
  });

  describe('Initial Load and Setup', () => {
    it('should load existing chat rooms on initialization', async () => {
      // Pre-populate storage with test data
      const testRooms = TestDataFactory.createMockChatRooms(3);
      for (const room of testRooms) {
        await mockIndexedDB.saveChatRoom(room);
      }
      await mockIndexedDB.setSetting('activeChatRoom', testRooms[0].id);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(testRooms[0].name)).toBeInTheDocument();
      });

      // All rooms should be displayed
      testRooms.forEach(room => {
        expect(screen.getByText(room.name)).toBeInTheDocument();
      });

      // First room should be active
      const activeRoom = screen.getByText(testRooms[0].name).closest('[data-testid="chat-item"]');
      expect(activeRoom).toHaveClass('active');
    });

    it('should handle empty initial state', async () => {
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/no chat rooms/i)).toBeInTheDocument();
      });

      // Should show new chat button
      expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
    });

    it('should handle storage initialization errors gracefully', async () => {
      // Simulate storage error
      mockIndexedDB.__testUtils.simulateError(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        // Should show error state or fallback UI
        expect(screen.getByText(/error loading/i) || screen.getByText(/no chat rooms/i)).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Creating New Chat Rooms', () => {
    it('should create new chat room and switch to it', async () => {
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
      });

      // Click new chat button
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      // Wait for new room to be created and displayed
      await waitFor(() => {
        expect(screen.getByText(/對話 1/)).toBeInTheDocument();
      });

      // Verify room is active
      const newRoom = screen.getByText(/對話 1/).closest('[data-testid="chat-item"]');
      expect(newRoom).toHaveClass('active');

      // Verify room is saved to storage
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms).toHaveLength(1);
      expect(savedRooms[0].name).toMatch(/對話 1/);
    });

    it('should increment room names correctly', async () => {
      // Create initial room
      const initialRoom = TestDataFactory.createMockChatRoom({ name: '對話 1' });
      await mockIndexedDB.saveChatRoom(initialRoom);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText('對話 1')).toBeInTheDocument();
      });

      // Create second room
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      await user.click(newChatButton);

      await waitFor(() => {
        expect(screen.getByText(/對話 2/)).toBeInTheDocument();
      });

      // Verify both rooms exist
      expect(screen.getByText('對話 1')).toBeInTheDocument();
      expect(screen.getByText(/對話 2/)).toBeInTheDocument();
    });

    it('should handle creation errors gracefully', async () => {
      // Simulate storage error after initialization
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
      });

      // Enable errors after component loads
      mockIndexedDB.__testUtils.simulateError(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      
      await user.click(newChatButton);

      // Should show error message or remain in previous state
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Switching Between Chat Rooms', () => {
    beforeEach(async () => {
      // Setup multiple rooms
      const rooms = TestDataFactory.createMockChatRooms(3);
      for (const room of rooms) {
        await mockIndexedDB.saveChatRoom(room);
      }
      await mockIndexedDB.setSetting('activeChatRoom', rooms[0].id);
    });

    it('should switch active room when clicking another room', async () => {
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Click on second room
      const secondRoom = screen.getByText(/測試對話 2/);
      await user.click(secondRoom);

      await waitFor(() => {
        const activeRoom = secondRoom.closest('[data-testid="chat-item"]');
        expect(activeRoom).toHaveClass('active');
      });

      // Verify active room is persisted
      const activeChatRoom = await mockIndexedDB.getSetting('activeChatRoom');
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      const activeRoom = savedRooms.find(room => room.id === activeChatRoom);
      expect(activeRoom?.name).toMatch(/測試對話 2/);
    });

    it('should update conversation area when switching rooms', async () => {
      // Create rooms with different messages
      const room1 = TestDataFactory.createMockChatRoom({
        name: '房間 1',
        messageCount: 2
      });
      const room2 = TestDataFactory.createMockChatRoom({
        name: '房間 2',
        messageCount: 1
      });
      
      room1.messages[0].content = 'Room 1 Message';
      room2.messages[0].content = 'Room 2 Message';

      await mockIndexedDB.saveChatRoom(room1);
      await mockIndexedDB.saveChatRoom(room2);
      await mockIndexedDB.setSetting('activeChatRoom', room1.id);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText('Room 1 Message')).toBeInTheDocument();
      });

      // Switch to room 2
      const room2Element = screen.getByText('房間 2');
      await user.click(room2Element);

      await waitFor(() => {
        expect(screen.getByText('Room 2 Message')).toBeInTheDocument();
        expect(screen.queryByText('Room 1 Message')).not.toBeInTheDocument();
      });
    });

    it('should handle switch errors gracefully', async () => {
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Simulate error during switch
      mockIndexedDB.__testUtils.simulateError(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const secondRoom = screen.getByText(/測試對話 2/);
      
      await user.click(secondRoom);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Renaming Chat Rooms', () => {
    beforeEach(async () => {
      const rooms = TestDataFactory.createMockChatRooms(2);
      for (const room of rooms) {
        await mockIndexedDB.saveChatRoom(room);
      }
    });

    it('should rename chat room when requested', async () => {
      const newName = 'Renamed Room';
      (window.prompt as jest.Mock).mockReturnValue(newName);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Right-click to open context menu (or find rename button)
      const roomElement = screen.getByText(/測試對話 1/);
      await user.contextMenu(roomElement);

      // Find and click rename option
      const renameButton = screen.getByRole('button', { name: /rename/i });
      await user.click(renameButton);

      expect(window.prompt).toHaveBeenCalledWith(
        '請輸入新的聊天室名稱：',
        expect.stringMatching(/測試對話 1/)
      );

      await waitFor(() => {
        expect(screen.getByText(newName)).toBeInTheDocument();
        expect(screen.queryByText(/測試對話 1/)).not.toBeInTheDocument();
      });

      // Verify name is persisted
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      const renamedRoom = savedRooms.find(room => room.name === newName);
      expect(renamedRoom).toBeDefined();
    });

    it('should not rename when user cancels prompt', async () => {
      (window.prompt as jest.Mock).mockReturnValue(null);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      const roomElement = screen.getByText(/測試對話 1/);
      await user.contextMenu(roomElement);

      const renameButton = screen.getByRole('button', { name: /rename/i });
      await user.click(renameButton);

      // Original name should remain
      expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
    });

    it('should not rename with empty name', async () => {
      (window.prompt as jest.Mock).mockReturnValue('   ');

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      const roomElement = screen.getByText(/測試對話 1/);
      await user.contextMenu(roomElement);

      const renameButton = screen.getByRole('button', { name: /rename/i });
      await user.click(renameButton);

      // Original name should remain
      expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
    });
  });

  describe('Deleting Chat Rooms', () => {
    beforeEach(async () => {
      const rooms = TestDataFactory.createMockChatRooms(3);
      for (const room of rooms) {
        await mockIndexedDB.saveChatRoom(room);
      }
      await mockIndexedDB.setSetting('activeChatRoom', rooms[0].id);
    });

    it('should delete chat room after confirmation', async () => {
      (window.confirm as jest.Mock).mockReturnValue(true);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Right-click to open context menu
      const roomElement = screen.getByText(/測試對話 2/);
      await user.contextMenu(roomElement);

      // Find and click delete option
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('確定要刪除')
      );

      await waitFor(() => {
        expect(screen.queryByText(/測試對話 2/)).not.toBeInTheDocument();
      });

      // Verify room is removed from storage
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      expect(savedRooms).toHaveLength(2);
      expect(savedRooms.find(room => room.name.includes('測試對話 2'))).toBeUndefined();
    });

    it('should not delete when user cancels confirmation', async () => {
      (window.confirm as jest.Mock).mockReturnValue(false);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      const roomElement = screen.getByText(/測試對話 2/);
      await user.contextMenu(roomElement);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Room should still be present
      expect(screen.getByText(/測試對話 2/)).toBeInTheDocument();
    });

    it('should switch to another room when deleting active room', async () => {
      (window.confirm as jest.Mock).mockReturnValue(true);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Delete the active room (first one)
      const activeRoomElement = screen.getByText(/測試對話 1/);
      await user.contextMenu(activeRoomElement);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText(/測試對話 1/)).not.toBeInTheDocument();
      });

      // Another room should become active
      const remainingRooms = screen.getAllByText(/測試對話/);
      expect(remainingRooms.length).toBeGreaterThan(0);
      
      // One of the remaining rooms should be active
      const activeRoom = remainingRooms.find(room => 
        room.closest('[data-testid="chat-item"]')?.classList.contains('active')
      );
      expect(activeRoom).toBeDefined();
    });

    it('should handle deletion errors with rollback', async () => {
      (window.confirm as jest.Mock).mockReturnValue(true);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Enable errors after confirmation
      mockIndexedDB.__testUtils.simulateError(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const roomElement = screen.getByText(/測試對話 2/);
      await user.contextMenu(roomElement);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Room should still be present due to error
      expect(screen.getByText(/測試對話 2/)).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Message Persistence Across Room Operations', () => {
    it('should preserve messages when switching rooms', async () => {
      // Create rooms with messages
      const room1 = TestDataFactory.createMockChatRoom({
        name: 'Room 1',
        messageCount: 3
      });
      const room2 = TestDataFactory.createMockChatRoom({
        name: 'Room 2',
        messageCount: 2
      });

      room1.messages.forEach((msg, index) => {
        msg.content = `Room 1 Message ${index + 1}`;
      });
      room2.messages.forEach((msg, index) => {
        msg.content = `Room 2 Message ${index + 1}`;
      });

      await mockIndexedDB.saveChatRoom(room1);
      await mockIndexedDB.saveChatRoom(room2);
      await mockIndexedDB.setSetting('activeChatRoom', room1.id);

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      // Verify room 1 messages are displayed
      await waitFor(() => {
        expect(screen.getByText('Room 1 Message 1')).toBeInTheDocument();
        expect(screen.getByText('Room 1 Message 2')).toBeInTheDocument();
        expect(screen.getByText('Room 1 Message 3')).toBeInTheDocument();
      });

      // Switch to room 2
      const room2Element = screen.getByText('Room 2');
      await user.click(room2Element);

      // Verify room 2 messages are displayed
      await waitFor(() => {
        expect(screen.getByText('Room 2 Message 1')).toBeInTheDocument();
        expect(screen.getByText('Room 2 Message 2')).toBeInTheDocument();
        expect(screen.queryByText('Room 1 Message 1')).not.toBeInTheDocument();
      });

      // Switch back to room 1
      const room1Element = screen.getByText('Room 1');
      await user.click(room1Element);

      // Verify room 1 messages are restored
      await waitFor(() => {
        expect(screen.getByText('Room 1 Message 1')).toBeInTheDocument();
        expect(screen.getByText('Room 1 Message 2')).toBeInTheDocument();
        expect(screen.getByText('Room 1 Message 3')).toBeInTheDocument();
        expect(screen.queryByText('Room 2 Message 1')).not.toBeInTheDocument();
      });
    });

    it('should preserve messages after room rename', async () => {
      const room = TestDataFactory.createMockChatRoom({
        name: 'Original Name',
        messageCount: 2
      });
      room.messages[0].content = 'Important Message 1';
      room.messages[1].content = 'Important Message 2';

      await mockIndexedDB.saveChatRoom(room);
      await mockIndexedDB.setSetting('activeChatRoom', room.id);

      (window.prompt as jest.Mock).mockReturnValue('New Name');

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      // Verify initial messages
      await waitFor(() => {
        expect(screen.getByText('Important Message 1')).toBeInTheDocument();
        expect(screen.getByText('Important Message 2')).toBeInTheDocument();
      });

      // Rename the room
      const roomElement = screen.getByText('Original Name');
      await user.contextMenu(roomElement);

      const renameButton = screen.getByRole('button', { name: /rename/i });
      await user.click(renameButton);

      await waitFor(() => {
        expect(screen.getByText('New Name')).toBeInTheDocument();
      });

      // Messages should still be present
      expect(screen.getByText('Important Message 1')).toBeInTheDocument();
      expect(screen.getByText('Important Message 2')).toBeInTheDocument();

      // Verify messages are persisted with renamed room
      const savedRooms = await mockIndexedDB.getAllChatRooms();
      const renamedRoom = savedRooms.find(r => r.name === 'New Name');
      expect(renamedRoom?.messages).toHaveLength(2);
      expect(renamedRoom?.messages[0].content).toBe('Important Message 1');
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should handle rapid room switching without lag', async () => {
      // Create multiple rooms
      const rooms = TestDataFactory.createMockChatRooms(5);
      for (const room of rooms) {
        await mockIndexedDB.saveChatRoom(room);
      }

      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByText(/測試對話 1/)).toBeInTheDocument();
      });

      // Rapidly switch between rooms
      const roomElements = screen.getAllByText(/測試對話/);
      
      for (let i = 0; i < roomElements.length; i++) {
        await user.click(roomElements[i]);
        // Should respond quickly without blocking
        await waitForAsync(10);
      }

      // Final room should be active
      const lastRoom = roomElements[roomElements.length - 1];
      const activeRoom = lastRoom.closest('[data-testid="chat-item"]');
      expect(activeRoom).toHaveClass('active');
    });

    it('should handle bulk operations efficiently', async () => {
      const { user } = renderWithProviders(<ChatRoomManagementTest />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
      });

      const startTime = Date.now();

      // Create multiple rooms quickly
      const newChatButton = screen.getByRole('button', { name: /new chat/i });
      
      for (let i = 0; i < 5; i++) {
        await user.click(newChatButton);
        await waitForAsync(50); // Small delay to prevent overwhelming
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(3000);

      // All rooms should be created
      await waitFor(() => {
        for (let i = 1; i <= 5; i++) {
          expect(screen.getByText(`對話 ${i}`)).toBeInTheDocument();
        }
      });
    });
  });
});