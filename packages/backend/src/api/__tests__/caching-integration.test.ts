/**
 * Cache Integration Tests - API Endpoints with Redis Caching
 *
 * This test suite covers the integration between the Redis cache layer
 * and the existing API endpoints for tag operations.
 */

import { createApp } from '../../app.js';
import { RedisCacheService } from '../../infrastructure/cache/redis-cache-service.js';
import { DataSource } from 'typeorm';
import { AuthService } from '../../auth/index.js';
import request from 'supertest';
import { createClient } from 'redis';

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  mGet: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn(),
  isOpen: true,
  on: jest.fn(),
  off: jest.fn(),
} as any;

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock DataSource - reset to empty array each time to avoid cross-test contamination
const mockDataSource = {
  query: jest.fn(),
  isInitialized: true,
  initialize: jest.fn(),
} as unknown as DataSource;

// Mock AuthService
const mockAuthService = {
  getJwtService: () => ({
    generateToken: jest.fn(() => 'mock-jwt-token'),
    verifyToken: jest.fn(() => ({
      userId: 'user-123',
      email: 'test@example.com',
    })),
  }),
  getConfig: jest.fn(() => ({
    google: {
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      callbackUrl: 'http://localhost:3001/auth/google/callback',
    },
    session: {
      secret: 'test-secret',
      name: 'test-session',
    },
  })),
  getSessionConfig: jest.fn(() => ({
    secret: 'test-secret',
    name: 'test-session',
  })),
} as unknown as AuthService;

describe('API Cache Integration - /api/tags endpoint', () => {
  let app: any;
  let cacheService: RedisCacheService;

  beforeEach(() => {
    // Reset mockDataSource to return empty array by default
    mockDataSource.query.mockResolvedValue([]);

    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
      enableMetrics: true,
    });

    // Inject the mock Redis client
    (cacheService as any).client = mockRedisClient;

    app = createApp({
      authService: mockAuthService,
      dataSource: mockDataSource,
      cacheService: cacheService,
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should return cached tag statistics on cache hit', async () => {
    const cachedStats = [
      { tag: 'project', count: 5 },
      { tag: 'meeting', count: 3 },
    ];

    // Mock cache hit
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedStats));
    mockRedisClient.incr.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/tags')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response.body).toEqual(cachedStats);

    // Should track cache hit
    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'misc-poc:metrics:tag-stats:hits'
    );

    // Should NOT query database
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('should query database and cache result on cache miss', async () => {
    const dbResult = [
      { tag: 'project', count: '5' },
      { tag: 'meeting', count: '3' },
    ];

    const expectedResult = [
      { tag: 'project', count: 5 },
      { tag: 'meeting', count: 3 },
    ];

    // Mock cache miss
    mockRedisClient.get.mockResolvedValueOnce(null);
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.set.mockResolvedValue('OK');

    // Mock database query
    mockDataSource.query.mockResolvedValueOnce(dbResult);

    const response = await request(app)
      .get('/api/tags')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response.body).toEqual(expectedResult);

    // Should track cache miss
    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'misc-poc:metrics:tag-stats:misses'
    );

    // Should query database
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      ['user-123']
    );

    // Should cache the result
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'misc-poc:tag-stats:user-123',
      JSON.stringify(expectedResult),
      { EX: 300 }
    );
  });

  it('should handle cache failures gracefully and still serve data', async () => {
    const dbResult = [{ tag: 'project', count: '5' }];

    // Mock cache error
    mockRedisClient.get.mockRejectedValueOnce(
      new Error('Redis connection failed')
    );

    // Mock database query
    mockDataSource.query.mockResolvedValueOnce(dbResult);

    const response = await request(app)
      .get('/api/tags')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response.body).toEqual([{ tag: 'project', count: 5 }]);

    // Should still query database when cache fails
    expect(mockDataSource.query).toHaveBeenCalled();
  });

  it('should isolate cache by user ID', async () => {
    // Set up different mock tokens for different users
    const mockAuthServiceUser1 = {
      getJwtService: (): unknown => ({
        generateToken: jest.fn(),
        verifyToken: jest.fn(() => ({
          userId: 'user-123',
          email: 'user1@example.com',
        })),
      }),
      getConfig: jest.fn(() => ({
        google: {
          clientId: 'mock-client-id',
          clientSecret: 'mock-client-secret',
          callbackUrl: 'http://localhost:3001/auth/google/callback',
        },
      })),
      getSessionConfig: (): unknown => ({
        secret: 'test-secret-user1',
        name: 'test-session',
        resave: false,
        saveUninitialized: false,
      }),
    };

    const mockAuthServiceUser2 = {
      getJwtService: (): unknown => ({
        generateToken: jest.fn(),
        verifyToken: jest.fn(() => ({
          userId: 'user-456',
          email: 'user2@example.com',
        })),
      }),
      getConfig: jest.fn(() => ({
        google: {
          clientId: 'mock-client-id',
          clientSecret: 'mock-client-secret',
          callbackUrl: 'http://localhost:3001/auth/google/callback',
        },
      })),
      getSessionConfig: (): unknown => ({
        secret: 'test-secret-user2',
        name: 'test-session',
        resave: false,
        saveUninitialized: false,
      }),
    };

    // Create a shared cache service instance for both apps
    const sharedCacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
      enableMetrics: true, // Enable metrics for these integration tests
    });
    // Inject the mock Redis client
    (sharedCacheService as any).client = mockRedisClient;

    const app1: unknown = createApp({
      authService: mockAuthServiceUser1,
      dataSource: mockDataSource,
      cacheService: sharedCacheService,
    });
    const app2: unknown = createApp({
      authService: mockAuthServiceUser2,
      dataSource: mockDataSource,
      cacheService: sharedCacheService,
    });

    // Mock different cached results for different users
    mockRedisClient.get
      .mockResolvedValueOnce(
        JSON.stringify([{ tag: 'user1-project', count: 5 }])
      )
      .mockResolvedValueOnce(
        JSON.stringify([{ tag: 'user2-meeting', count: 3 }])
      );

    const response1 = await request(app1)
      .get('/api/tags')
      .set('Authorization', 'Bearer user1-token')
      .expect(200);

    const response2 = await request(app2)
      .get('/api/tags')
      .set('Authorization', 'Bearer user2-token')
      .expect(200);

    expect(response1.body).toEqual([{ tag: 'user1-project', count: 5 }]);
    expect(response2.body).toEqual([{ tag: 'user2-meeting', count: 3 }]);

    // Should use different cache keys
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-stats:user-123'
    );
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-stats:user-456'
    );
  });
});

describe('API Cache Integration - /api/tags/suggest endpoint', () => {
  let app: any;
  let cacheService: RedisCacheService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mockDataSource to return empty array by default
    mockDataSource.query.mockResolvedValue([]);

    // Reset mock Redis client to default empty behavior
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.mGet.mockResolvedValue([]);
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.disconnect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');

    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
      ttlConfig: {
        tagSuggestions: 1800, // 30 minutes for suggestions
      },
      enableMetrics: true, // Enable metrics for these integration tests
    });

    // Inject the mock Redis client
    (cacheService as any).client = mockRedisClient;

    app = createApp({
      authService: mockAuthService,
      dataSource: mockDataSource,
      cacheService: cacheService,
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should return cached tag suggestions on cache hit', async () => {
    const cachedSuggestions = ['project', 'projection', 'projector'];

    // Mock cache hit
    mockRedisClient.get.mockResolvedValueOnce(
      JSON.stringify(cachedSuggestions)
    );
    mockRedisClient.incr.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/tags/suggest?q=proj&limit=10')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response.body).toEqual(cachedSuggestions);

    // Should check cache with normalized query
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:10'
    );

    // Should track cache hit
    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'misc-poc:metrics:tag-suggest:hits'
    );

    // Should NOT query database
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('should query database and cache result on cache miss', async () => {
    const dbResult = [{ tag: 'project' }, { tag: 'projection' }];

    const expectedResult = ['project', 'projection'];

    // Mock cache miss
    mockRedisClient.get.mockResolvedValueOnce(null);
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.set.mockResolvedValue('OK');

    // Mock database query
    mockDataSource.query.mockResolvedValueOnce(dbResult);

    const response = await request(app)
      .get('/api/tags/suggest?q=proj&limit=5')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response.body).toEqual(expectedResult);

    // Should track cache miss
    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'misc-poc:metrics:tag-suggest:misses'
    );

    // Should query database with correct parameters
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tag ILIKE'),
      ['user-123', 'proj%', 5]
    );

    // Should cache with configured TTL
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:5',
      JSON.stringify(expectedResult),
      { EX: 1800 } // Custom TTL for suggestions
    );
  });

  it('should normalize query parameters for consistent caching', async () => {
    // Mock cache miss
    mockRedisClient.get.mockResolvedValueOnce(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockDataSource.query.mockResolvedValueOnce([{ tag: 'project' }]);

    await request(app)
      .get('/api/tags/suggest?q=%20PROJ%20&limit=10') // URL encoded " PROJ "
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    // Should normalize to lowercase and trim whitespace
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:10'
    );
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:10',
      expect.any(String),
      { EX: 1800 }
    );
  });

  it('should handle different limits for same query correctly', async () => {
    // Mock different cached results for different limits
    mockRedisClient.get
      .mockResolvedValueOnce(JSON.stringify(['project', 'projection'])) // limit 5
      .mockResolvedValueOnce(
        JSON.stringify(['project', 'projection', 'projector'])
      ); // limit 10

    const response5 = await request(app)
      .get('/api/tags/suggest?q=proj&limit=5')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    const response10 = await request(app)
      .get('/api/tags/suggest?q=proj&limit=10')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(200);

    expect(response5.body).toEqual(['project', 'projection']);
    expect(response10.body).toEqual(['project', 'projection', 'projector']);

    // Should use different cache keys for different limits
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:5'
    );
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'misc-poc:tag-suggest:user-123:proj:10'
    );
  });

  it('should validate query parameters and return appropriate errors', async () => {
    // Empty query
    await request(app)
      .get('/api/tags/suggest?q=')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(400);

    // Missing query
    await request(app)
      .get('/api/tags/suggest')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(400);

    // Invalid limit
    await request(app)
      .get('/api/tags/suggest?q=test&limit=invalid')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(400);

    // Limit out of range
    await request(app)
      .get('/api/tags/suggest?q=test&limit=200')
      .set('Authorization', 'Bearer valid-jwt-token')
      .expect(400);

    // Should not interact with cache for invalid requests
    expect(mockRedisClient.get).not.toHaveBeenCalled();
  });
});

describe('API Cache Integration - Record Operations & Cache Invalidation', () => {
  let app: any;
  let cacheService: RedisCacheService;

  beforeEach(() => {
    // Reset mockDataSource to return empty array by default
    mockDataSource.query.mockResolvedValue([]);

    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
    });

    // Inject the mock Redis client
    (cacheService as any).client = mockRedisClient;

    app = createApp({
      authService: mockAuthService,
      dataSource: mockDataSource,
      cacheService: cacheService,
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should invalidate cache when record is created', async () => {
    mockRedisClient.del.mockResolvedValue(2);
    mockDataSource.query.mockResolvedValue([{ id: '1' }]);

    // This would be the POST /api/records endpoint (not yet implemented in test)
    // Simulating cache invalidation that should happen
    await cacheService.invalidateUserTagCache('user-123');

    expect(mockRedisClient.del).toHaveBeenCalledWith([
      'misc-poc:tag-stats:user-123',
      'misc-poc:tag-suggest-pattern:user-123',
    ]);
  });

  it('should invalidate cache when record is updated', async () => {
    mockRedisClient.del.mockResolvedValue(2);

    // This would be the PUT /api/records/:id endpoint
    await cacheService.invalidateUserTagCache('user-123');

    expect(mockRedisClient.del).toHaveBeenCalled();
  });

  it('should invalidate cache when record is deleted', async () => {
    mockRedisClient.del.mockResolvedValue(2);

    // This would be the DELETE /api/records/:id endpoint
    await cacheService.invalidateUserTagCache('user-123');

    expect(mockRedisClient.del).toHaveBeenCalled();
  });

  it('should handle selective invalidation for specific tags', async () => {
    const affectedTags = ['project', 'meeting'];

    mockRedisClient.del.mockResolvedValue(3);

    await cacheService.invalidateTagSuggestionPatterns(
      'user-123',
      affectedTags
    );

    expect(mockRedisClient.del).toHaveBeenCalled();
  });
});

describe('API Cache Integration - Cache Warming & Background Jobs', () => {
  let cacheService: RedisCacheService;

  beforeEach(() => {
    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should warm tag statistics cache for active users', async () => {
    const activeUsers = ['user-123', 'user-456'];

    mockDataSource.query
      .mockResolvedValueOnce([{ tag: 'project', count: '5' }])
      .mockResolvedValueOnce([{ tag: 'meeting', count: '3' }]);

    mockRedisClient.set.mockResolvedValue('OK');

    await cacheService.batchWarmTagStatistics(activeUsers, mockDataSource);

    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    expect(mockRedisClient.set).toHaveBeenCalledTimes(2);

    expect(mockRedisClient.set).toHaveBeenNthCalledWith(
      1,
      'misc-poc:tag-stats:user-123',
      JSON.stringify([{ tag: 'project', count: 5 }]),
      { EX: 300 }
    );

    expect(mockRedisClient.set).toHaveBeenNthCalledWith(
      2,
      'misc-poc:tag-stats:user-456',
      JSON.stringify([{ tag: 'meeting', count: 3 }]),
      { EX: 300 }
    );
  });

  it('should warm popular tag suggestions for power users', async () => {
    const userId = 'user-123';
    const popularPrefixes = ['p', 'm'];

    mockDataSource.query
      .mockResolvedValueOnce([{ tag: 'project' }, { tag: 'phone' }])
      .mockResolvedValueOnce([{ tag: 'meeting' }, { tag: 'mobile' }]);

    mockRedisClient.set.mockResolvedValue('OK');

    await cacheService.warmPopularTagSuggestions(
      userId,
      popularPrefixes,
      mockDataSource
    );

    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
  });

  it('should handle warming failures gracefully', async () => {
    const activeUsers = ['user-123', 'user-456'];

    // First user succeeds, second fails
    mockDataSource.query
      .mockResolvedValueOnce([{ tag: 'project', count: '5' }])
      .mockRejectedValueOnce(new Error('Database connection failed'));

    mockRedisClient.set.mockResolvedValue('OK');

    // Should not throw and should continue with other users
    await expect(
      cacheService.batchWarmTagStatistics(activeUsers, mockDataSource)
    ).resolves.not.toThrow();

    expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    expect(mockRedisClient.set).toHaveBeenCalledTimes(1); // Only successful one
  });
});

describe('API Cache Integration - Metrics & Monitoring', () => {
  let cacheService: RedisCacheService;

  beforeEach(() => {
    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
      enableMetrics: true,
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should provide comprehensive cache metrics', async () => {
    // Mock metrics data
    mockRedisClient.mGet.mockResolvedValue(['150', '50', '300', '75']);

    const metrics = await cacheService.getCacheMetrics();

    expect(metrics).toEqual({
      tagStatistics: {
        hits: 150,
        misses: 50,
        hitRate: 0.75,
      },
      tagSuggestions: {
        hits: 300,
        misses: 75,
        hitRate: 0.8,
      },
      overall: {
        hits: 450,
        misses: 125,
        hitRate: 0.783,
      },
    });
  });

  it('should reset metrics when requested', async () => {
    mockRedisClient.del.mockResolvedValue(4);

    await cacheService.resetCacheMetrics();

    expect(mockRedisClient.del).toHaveBeenCalledWith([
      'misc-poc:metrics:tag-stats:hits',
      'misc-poc:metrics:tag-stats:misses',
      'misc-poc:metrics:tag-suggest:hits',
      'misc-poc:metrics:tag-suggest:misses',
    ]);
  });

  it('should expose cache health status', async () => {
    mockRedisClient.ping.mockResolvedValue('PONG');

    const isHealthy = await cacheService.isHealthy();

    expect(isHealthy).toBe(true);
    expect(mockRedisClient.ping).toHaveBeenCalled();
  });
});

describe('API Cache Integration - Production Scenarios', () => {
  let cacheService: RedisCacheService;

  beforeEach(() => {
    cacheService = new RedisCacheService({
      url: 'redis://localhost:6379',
      keyPrefix: 'misc-poc:',
      defaultTTL: 300,
      ttlConfig: {
        tagStatistics: 600,
        tagSuggestions: 1800,
      },
    });
  });

  afterEach(async () => {
    await cacheService?.disconnect();
  });

  it('should handle high concurrent load with proper key isolation', async () => {
    // Simulate 10 concurrent requests for different users
    const users = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    const promises = users.map((userId) =>
      cacheService.getTagStatistics(userId)
    );

    mockRedisClient.get.mockResolvedValue(null);

    await Promise.all(promises);

    // Each user should have their own cache key
    users.forEach((userId) => {
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `misc-poc:tag-stats:${userId}`
      );
    });
  });

  it('should handle memory pressure gracefully with TTL expiration', async () => {
    const userId = 'user-123';
    const tagStats = [{ tag: 'project', count: 5 }];

    // First set with TTL
    mockRedisClient.set.mockResolvedValue('OK');
    await cacheService.setTagStatistics(userId, tagStats);

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'misc-poc:tag-stats:user-123',
      JSON.stringify(tagStats),
      { EX: 600 }
    );

    // After TTL expires, should return null
    mockRedisClient.get.mockResolvedValue(null);
    const expired = await cacheService.getTagStatistics(userId);

    expect(expired).toBeNull();
  });

  it('should support cache preloading for system startup', async () => {
    const systemUsers = ['user-1', 'user-2', 'user-3'];

    mockDataSource.query.mockResolvedValue([{ tag: 'system', count: '1' }]);
    mockRedisClient.set.mockResolvedValue('OK');

    // Preload all active users on system startup
    await cacheService.batchWarmTagStatistics(systemUsers, mockDataSource);

    expect(mockDataSource.query).toHaveBeenCalledTimes(3);
    expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
  });

  it('should maintain data consistency during cache invalidation', async () => {
    const userId = 'user-123';

    // Simulate record update that affects multiple tags
    const oldTags = ['old-project', 'meeting'];
    const newTags = ['new-project', 'urgent', 'meeting'];

    mockRedisClient.del.mockResolvedValue(5);

    // Should invalidate all related cache patterns
    await cacheService.invalidateTagSuggestionPatterns(userId, [
      ...oldTags,
      ...newTags,
    ]);

    expect(mockRedisClient.del).toHaveBeenCalled();
  });
});
