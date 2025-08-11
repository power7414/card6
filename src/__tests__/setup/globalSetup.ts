/**
 * Global Test Setup
 * 
 * Runs once before all tests. Used for setting up test environment,
 * initializing databases, and preparing global test state.
 */

export default async function globalSetup() {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  
  // Disable console warnings for tests
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('React Router') ||
       args[0].includes('act(') ||
       args[0].includes('Warning:'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  console.log('🧪 Global test setup completed');
}