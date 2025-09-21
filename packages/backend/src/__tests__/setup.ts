/**
 * Jest test setup file
 */

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_ISSUER = 'test-issuer';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = '/test/auth/google/callback';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.SESSION_NAME = 'test-session';
process.env.SESSION_MAX_AGE = '3600000'; // 1 hour
process.env.NODE_ENV = 'test';

// Database mock configuration
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Database mocking will be added when pg module is installed

// Extend Jest matchers if needed
beforeAll(() => {
  // Global test setup
});

afterAll(() => {
  // Global test cleanup
});

beforeEach(() => {
  // Per-test setup
});

afterEach(() => {
  // Per-test cleanup
  jest.clearAllMocks();
});

// Simple test to ensure setup file is valid
describe('Test Setup', () => {
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBe('test-jwt-secret');
  });
});
