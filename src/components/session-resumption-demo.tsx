/**
 * Session Resumption Demo Component
 * 
 * Demonstrates how to use the session resumption functionality with Live API.
 * This component shows how to connect with session resumption and handle
 * session state across different chat rooms.
 */

import React, { useCallback, useState } from 'react';
import { useLiveAPI } from '../hooks/use-live-api';
import { usePersistentChatStore } from '../stores/chat-store-persistent';

interface SessionResumptionDemoProps {
  apiKey: string;
}

export const SessionResumptionDemo: React.FC<SessionResumptionDemoProps> = ({ apiKey }) => {
  const liveAPI = useLiveAPI({ apiKey });
  const { chatRooms, activeChatRoom } = usePersistentChatStore();
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [sessionInfo, setSessionInfo] = useState<string>('No session info');

  const handleConnectWithResumption = useCallback(async () => {
    if (!activeChatRoom) {
      setConnectionStatus('Error: No active chat room');
      return;
    }

    try {
      setConnectionStatus('Connecting...');
      
      const hasSession = liveAPI.hasValidSession(activeChatRoom);
      setSessionInfo(`Room ${activeChatRoom}: ${hasSession ? 'Has valid session' : 'No valid session'}`);
      
      await liveAPI.connectWithResumption(activeChatRoom);
      
      setConnectionStatus('Connected with resumption');
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [liveAPI, activeChatRoom]);

  const handleRegularConnect = useCallback(async () => {
    try {
      setConnectionStatus('Connecting (regular)...');
      await liveAPI.connect();
      setConnectionStatus('Connected (regular)');
    } catch (error) {
      console.error('Regular connection failed:', error);
      setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [liveAPI]);

  const handleDisconnect = useCallback(async () => {
    try {
      await liveAPI.disconnect();
      setConnectionStatus('Disconnected');
      setSessionInfo('Session ended');
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }, [liveAPI]);

  const getSessionStats = useCallback(() => {
    const stats = [];
    for (const room of chatRooms) {
      const hasValid = liveAPI.hasValidSession(room.id);
      stats.push(`${room.name}: ${hasValid ? '✓' : '✗'} valid session`);
    }
    return stats;
  }, [chatRooms, liveAPI]);

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Session Resumption Demo</h2>
      
      {/* Connection Status */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Connection Status</h3>
        <p className={`text-sm p-2 rounded ${
          liveAPI.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {connectionStatus}
        </p>
      </div>

      {/* Session Information */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Session Information</h3>
        <p className="text-sm p-2 bg-blue-100 text-blue-800 rounded">
          {sessionInfo}
        </p>
        {liveAPI.currentChatRoomId && (
          <p className="text-xs text-gray-600 mt-1">
            Current room: {liveAPI.currentChatRoomId}
          </p>
        )}
      </div>

      {/* Session Stats */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">All Chat Room Sessions</h3>
        <div className="text-xs space-y-1">
          {getSessionStats().map((stat, index) => (
            <p key={index} className="p-1 bg-gray-100 rounded">
              {stat}
            </p>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleConnectWithResumption}
          disabled={!activeChatRoom || liveAPI.connected}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Connect with Session Resumption
        </button>
        
        <button
          onClick={handleRegularConnect}
          disabled={liveAPI.connected}
          className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Connect (Regular)
        </button>
        
        <button
          onClick={handleDisconnect}
          disabled={!liveAPI.connected}
          className="w-full py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Disconnect
        </button>
      </div>

      {/* Active Chat Room Info */}
      {activeChatRoom && (
        <div className="mt-4 text-xs text-gray-600">
          <p>Active Chat Room: {activeChatRoom}</p>
          <p>Has Valid Session: {liveAPI.hasValidSession(activeChatRoom) ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
};