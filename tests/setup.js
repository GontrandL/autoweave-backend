// Global test setup
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Set test timeouts
jest.setTimeout(10000);

// Mock external services
jest.mock('ioredis', () => {
  const RedisMock = jest.requireActual('ioredis-mock');
  return RedisMock;
});

// Global test utilities
global.testUtils = {
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for condition'));
        }
      }, 100);
    });
  },
  
  createMockLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    success: jest.fn()
  }),
  
  createMockEventBus: () => ({
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    request: jest.fn(),
    getHistory: jest.fn()
  })
};