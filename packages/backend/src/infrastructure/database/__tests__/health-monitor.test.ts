import { DatabaseHealthChecker } from '../connection-health';
import {
  DatabaseHealthMonitor,
  createHealthMonitor,
  createTestHealthMonitor,
} from '../health-monitor';

// Mock console.log to avoid cluttering test output
jest.spyOn(console, 'log').mockImplementation(() => {});

describe('DatabaseHealthMonitor', () => {
  let mockHealthChecker: jest.Mocked<DatabaseHealthChecker>;
  let monitor: DatabaseHealthMonitor;

  beforeEach(() => {
    // Create a mock health checker
    mockHealthChecker = {
      checkHealth: jest.fn(),
    } as any;

    monitor = new DatabaseHealthMonitor(mockHealthChecker, {
      interval: 100, // Fast interval for tests
      enableLogging: false, // Disable logging for tests
      alertThreshold: 2,
      degradedThreshold: 1000,
    });
  });

  afterEach(() => {
    monitor.stop();
    jest.clearAllMocks();
  });

  describe('start and stop', () => {
    it('should start monitoring', async () => {
      const mockResult = {
        isHealthy: true,
        responseTime: 50,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      monitor.start();

      // Wait for at least one check
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockHealthChecker.checkHealth).toHaveBeenCalled();

      const stats = monitor.getStats();
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.currentState).toBe('healthy');
    });

    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();

      // Should not throw when stopping again
      monitor.stop();
    });

    it('should not start twice', () => {
      monitor.start();
      monitor.start(); // Should not throw or start multiple monitors
      monitor.stop();
    });
  });

  describe('health state detection', () => {
    it('should detect healthy state', async () => {
      const mockResult = {
        isHealthy: true,
        responseTime: 50,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      await monitor.checkNow();

      expect(monitor.isHealthy()).toBe(true);
      expect(monitor.isDegraded()).toBe(false);

      const stats = monitor.getStats();
      expect(stats.currentState).toBe('healthy');
      expect(stats.successfulChecks).toBe(1);
      expect(stats.consecutiveFailures).toBe(0);
    });

    it('should detect unhealthy state', async () => {
      const mockResult = {
        isHealthy: false,
        responseTime: 0,
        attempt: 1,
        error: new Error('Connection failed'),
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      await monitor.checkNow();

      expect(monitor.isHealthy()).toBe(false);
      expect(monitor.isDegraded()).toBe(false);

      const stats = monitor.getStats();
      expect(stats.currentState).toBe('unhealthy');
      expect(stats.failedChecks).toBe(1);
      expect(stats.consecutiveFailures).toBe(1);
    });

    it('should detect degraded state', async () => {
      const mockResult = {
        isHealthy: true,
        responseTime: 2000, // Above degraded threshold (1000ms)
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      await monitor.checkNow();

      expect(monitor.isHealthy()).toBe(false);
      expect(monitor.isDegraded()).toBe(true);

      const stats = monitor.getStats();
      expect(stats.currentState).toBe('degraded');
      expect(stats.successfulChecks).toBe(1);
    });
  });

  describe('statistics tracking', () => {
    it('should track basic statistics', async () => {
      const healthyResult = {
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
      };

      const unhealthyResult = {
        ...healthyResult,
        isHealthy: false,
        error: new Error('Connection failed'),
      };

      mockHealthChecker.checkHealth
        .mockResolvedValueOnce(healthyResult)
        .mockResolvedValueOnce(unhealthyResult)
        .mockResolvedValueOnce(healthyResult);

      await monitor.checkNow();
      await monitor.checkNow();
      await monitor.checkNow();

      const stats = monitor.getStats();
      expect(stats.totalChecks).toBe(3);
      expect(stats.successfulChecks).toBe(2);
      expect(stats.failedChecks).toBe(1);
      expect(stats.uptimePercentage).toBeCloseTo(66.67, 1);
      expect(stats.consecutiveFailures).toBe(0); // Reset after last healthy check
    });

    it('should track response time statistics', async () => {
      const results = [
        { responseTime: 50 },
        { responseTime: 100 },
        { responseTime: 150 },
      ].map((partial) => ({
        isHealthy: true,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
        ...partial,
      }));

      mockHealthChecker.checkHealth
        .mockResolvedValueOnce(results[0])
        .mockResolvedValueOnce(results[1])
        .mockResolvedValueOnce(results[2]);

      await monitor.checkNow();
      await monitor.checkNow();
      await monitor.checkNow();

      const stats = monitor.getStats();
      expect(stats.minResponseTime).toBe(50);
      expect(stats.maxResponseTime).toBe(150);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(75);
      expect(stats.averageResponseTime).toBeLessThanOrEqual(125);
    });

    it('should reset statistics', async () => {
      const mockResult = {
        isHealthy: true,
        responseTime: 50,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      await monitor.checkNow();
      expect(monitor.getStats().totalChecks).toBe(1);

      monitor.resetStats();
      expect(monitor.getStats().totalChecks).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit health events', async () => {
      const healthyResult = {
        isHealthy: true,
        responseTime: 50,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      const unhealthyResult = {
        ...healthyResult,
        isHealthy: false,
        error: new Error('Connection failed'),
      };

      const healthEvents: any[] = [];
      const unhealthyEvents: any[] = [];
      const recoveredEvents: any[] = [];

      monitor.on('health', (event) => healthEvents.push(event));
      monitor.on('unhealthy', (event) => unhealthyEvents.push(event));
      monitor.on('recovered', (event) => recoveredEvents.push(event));

      mockHealthChecker.checkHealth.mockResolvedValue(unhealthyResult);
      await monitor.checkNow();

      mockHealthChecker.checkHealth.mockResolvedValue(healthyResult);
      await monitor.checkNow();

      expect(healthEvents).toHaveLength(2);
      expect(unhealthyEvents).toHaveLength(1);
      expect(recoveredEvents).toHaveLength(1);

      expect(unhealthyEvents[0].type).toBe('unhealthy');
      expect(recoveredEvents[0].type).toBe('recovered');
    });

    it('should emit alert events for consecutive failures', async () => {
      const unhealthyResult = {
        isHealthy: false,
        responseTime: 0,
        attempt: 1,
        error: new Error('Connection failed'),
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      const alertEvents: any[] = [];
      monitor.on('alert', (event) => alertEvents.push(event));

      mockHealthChecker.checkHealth.mockResolvedValue(unhealthyResult);

      // Trigger consecutive failures to reach alert threshold (2)
      await monitor.checkNow();
      await monitor.checkNow();

      expect(alertEvents).toHaveLength(1);
      expect(alertEvents[0].type).toBe('consecutive_failures');
    });

    it('should emit degraded events', async () => {
      const degradedResult = {
        isHealthy: true,
        responseTime: 2000, // Above degraded threshold
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      const degradedEvents: any[] = [];
      const alertEvents: any[] = [];
      monitor.on('degraded', (event) => degradedEvents.push(event));
      monitor.on('alert', (event) => alertEvents.push(event));

      mockHealthChecker.checkHealth.mockResolvedValue(degradedResult);
      await monitor.checkNow();

      expect(degradedEvents).toHaveLength(1);
      expect(alertEvents).toHaveLength(1);
      expect(alertEvents[0].type).toBe('performance_degraded');
    });
  });

  describe('recent results tracking', () => {
    it('should track recent results', async () => {
      const mockResult = {
        isHealthy: true,
        responseTime: 50,
        attempt: 1,
        timestamp: new Date(),
        connectionInfo: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
        },
      };

      mockHealthChecker.checkHealth.mockResolvedValue(mockResult);

      await monitor.checkNow();
      await monitor.checkNow();
      await monitor.checkNow();

      const recentResults = monitor.getRecentResults(2);
      expect(recentResults).toHaveLength(2);
    });
  });
});

describe('Factory functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHealthMonitor', () => {
    it('should create monitor with default health checker', () => {
      const monitor = createHealthMonitor();
      expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
    });

    it('should create monitor with provided health checker', () => {
      const healthChecker = new DatabaseHealthChecker();
      const monitor = createHealthMonitor(healthChecker);
      expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
    });

    it('should create monitor with configuration', () => {
      const monitor = createHealthMonitor(undefined, {
        interval: 5000,
        enableLogging: false,
      });
      expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
    });
  });

  describe('createTestHealthMonitor', () => {
    it('should create test monitor', () => {
      const monitor = createTestHealthMonitor();
      expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
    });

    it('should create test monitor with configuration', () => {
      const monitor = createTestHealthMonitor({
        alertThreshold: 5,
        enableLogging: true,
      });
      expect(monitor).toBeInstanceOf(DatabaseHealthMonitor);
    });
  });
});
