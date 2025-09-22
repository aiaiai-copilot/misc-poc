import {
  DatabaseHealthChecker,
  healthChecker,
  isHealthy,
  waitForDatabase,
  withRetry,
} from '../connection-health';

// Mock pg module
jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

describe('DatabaseHealthChecker', () => {
  let checker: DatabaseHealthChecker;
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Import after mock is set up
    const { Client } = require('pg');
    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    };

    (Client as jest.Mock).mockImplementation(() => mockClient);

    checker = new DatabaseHealthChecker({
      host: 'localhost',
      port: 5432,
      user: 'test_user',
      database: 'test_db',
      password: 'test_password',
      timeout: 1000,
    });
  });

  describe('checkHealth', () => {
    it('should return healthy result when connection succeeds', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const result = await checker.checkHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.attempt).toBe(1);
      expect(result.connectionInfo).toEqual({
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
      });
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy result when connection fails', async () => {
      const connectionError = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(connectionError);

      const result = await checker.checkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.attempt).toBe(1);
      expect(result.error).toBe(connectionError);
    });

    it('should return unhealthy result when query fails', async () => {
      const queryError = new Error('Query failed');
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockRejectedValue(queryError);

      const result = await checker.checkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toBe(queryError);
    });

    it('should use provided options', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const options = {
        host: 'custom-host',
        port: 5433,
        user: 'custom_user',
        database: 'custom_db',
      };

      const result = await checker.checkHealth(options);

      expect(result.connectionInfo).toEqual({
        host: 'custom-host',
        port: 5433,
        database: 'custom_db',
        user: 'custom_user',
      });
    });
  });

  describe('checkHealthWithRetry', () => {
    it('should succeed on first attempt', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const result = await checker.checkHealthWithRetry({ maxRetries: 3 });

      expect(result.isHealthy).toBe(true);
      expect(result.attempt).toBe(1);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockClient.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const result = await checker.checkHealthWithRetry({
        maxRetries: 3,
        retryDelay: 10, // Shorter delay for tests
        exponentialBackoff: false,
      });

      expect(result.isHealthy).toBe(true);
      expect(result.attempt).toBe(3);
      expect(mockClient.connect).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Persistent connection failure');
      mockClient.connect.mockRejectedValue(error);

      const result = await checker.checkHealthWithRetry({
        maxRetries: 2,
        retryDelay: 10,
        exponentialBackoff: false,
      });

      expect(result.isHealthy).toBe(false);
      expect(result.attempt).toBe(2);
      expect(result.error).toBe(error);
      expect(mockClient.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('waitForHealthy', () => {
    it('should return immediately when database is healthy', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const startTime = Date.now();
      const result = await checker.waitForHealthy({
        maxWaitTime: 5000,
        retryDelay: 100,
      });
      const endTime = Date.now();

      expect(result.isHealthy).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should be much faster
    });

    it('should timeout when database never becomes healthy', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await checker.waitForHealthy({
        maxWaitTime: 100,
        retryDelay: 20,
      });

      expect(result.isHealthy).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('createRetryWrapper', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const retryWrapper = checker.createRetryWrapper({ maxRetries: 3 });

      const result = await retryWrapper(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const retryWrapper = checker.createRetryWrapper({
        maxRetries: 3,
        initialDelay: 10,
        exponentialBackoff: false,
        jitter: false,
      });

      const result = await retryWrapper(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const authError = new Error('authentication failed');
      const operation = jest.fn().mockRejectedValue(authError);

      const retryWrapper = checker.createRetryWrapper({ maxRetries: 3 });

      await expect(retryWrapper(operation)).rejects.toBe(authError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const error = new Error('Persistent failure');
      const operation = jest.fn().mockRejectedValue(error);

      const retryWrapper = checker.createRetryWrapper({
        maxRetries: 2,
        initialDelay: 10,
        exponentialBackoff: false,
        jitter: false,
      });

      await expect(retryWrapper(operation)).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('createTestChecker', () => {
    it('should create checker with test database configuration', () => {
      const testChecker = DatabaseHealthChecker.createTestChecker();

      // We can't easily test the internal configuration, but we can test
      // that it's a valid DatabaseHealthChecker instance
      expect(testChecker).toBeInstanceOf(DatabaseHealthChecker);
    });

    it('should allow override of test configuration', () => {
      const testChecker = DatabaseHealthChecker.createTestChecker({
        timeout: 2000,
        maxRetries: 10,
      });

      expect(testChecker).toBeInstanceOf(DatabaseHealthChecker);
    });
  });

  describe('monitorHealth', () => {
    it('should yield health check results continuously', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockClient.end.mockResolvedValue(undefined);

      const monitor = checker.monitorHealth({ interval: 50 });
      const results: any[] = [];

      // Collect a few results
      for await (const result of monitor) {
        results.push(result);
        if (results.length >= 3) {
          break;
        }
      }

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.isHealthy).toBe(true);
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

describe('Utility functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isHealthy', () => {
    it('should return true when database is healthy', async () => {
      // Mock the healthChecker.checkHealth method
      const mockCheckHealth = jest.spyOn(healthChecker, 'checkHealth');
      mockCheckHealth.mockResolvedValue({
        isHealthy: true,
        responseTime: 100,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      });

      const result = await isHealthy();
      expect(result).toBe(true);

      mockCheckHealth.mockRestore();
    });
  });

  describe('waitForDatabase', () => {
    it('should resolve when database becomes healthy', async () => {
      const mockWaitForHealthy = jest.spyOn(healthChecker, 'waitForHealthy');
      mockWaitForHealthy.mockResolvedValue({
        isHealthy: true,
        responseTime: 100,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      });

      await expect(waitForDatabase()).resolves.toBeUndefined();

      mockWaitForHealthy.mockRestore();
    });

    it('should reject when database health check fails', async () => {
      const error = new Error('Database unavailable');
      const mockWaitForHealthy = jest.spyOn(healthChecker, 'waitForHealthy');
      mockWaitForHealthy.mockResolvedValue({
        isHealthy: false,
        responseTime: 0,
        attempt: 1,
        error,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      });

      await expect(waitForDatabase()).rejects.toBe(error);

      mockWaitForHealthy.mockRestore();
    });
  });

  describe('withRetry', () => {
    it('should wrap operation with retry logic', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
