/**
 * Test Helpers and Utilities
 * 
 * Common testing utilities for React components, user interactions,
 * async operations, and test environment setup.
 */

import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { UserEvent } from '@testing-library/user-event/dist/types/setup/setup';

import { LiveAPIContext } from '../../contexts/LiveAPIContext';
import { MockGenAILiveClient } from '../../__mocks__/google-genai-live-client';

/**
 * Custom render function with providers
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add provider options as needed
  initialRoute?: string;
  mockLiveAPIClient?: MockGenAILiveClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: UserEvent } {
  const {
    initialRoute = '/',
    mockLiveAPIClient,
    ...renderOptions
  } = options;

  // Create wrapper with all necessary providers
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const client = mockLiveAPIClient || new MockGenAILiveClient();
    
    return (
      <LiveAPIContext.Provider value={{
        client,
        connected: client.status === 'connected',
        connect: client.connect.bind(client),
        disconnect: client.disconnect.bind(client)
      }}>
        {children}
      </LiveAPIContext.Provider>
    );
  };

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  const user = userEvent.setup();

  return {
    ...result,
    user,
  };
}

/**
 * Async testing utilities
 */
export const waitFor = async (
  callback: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback();
      if (result) {
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout after ${timeout}ms waiting for condition`);
};

/**
 * User interaction helpers
 */
export const userInteractions = {
  async clickButton(user: UserEvent, buttonText: string) {
    const button = document.querySelector(`button:contains("${buttonText}")`);
    if (button) {
      await user.click(button);
    }
  },

  async typeIntoInput(user: UserEvent, selector: string, text: string) {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input) {
      await user.clear(input);
      await user.type(input, text);
    }
  }
};

/**
 * Test data factories
 */
export const createMockChatRoom = (overrides = {}) => ({
  id: 'test-room-1',
  name: 'Test Chat Room',
  createdAt: new Date(),
  lastMessageAt: new Date(),
  messages: [],
  isActive: false,
  ...overrides
});

export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-1',
  type: 'user' as const,
  content: 'Test message',
  timestamp: new Date(),
  ...overrides
});

// Export commonly used test utilities
export { screen, fireEvent } from '@testing-library/react';
export { userEvent };