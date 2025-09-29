export { RedisCacheService } from './redis-cache-service.js';
export type {
  RedisCacheConfig,
  TagStatistic,
  TagSuggestion,
  CacheMetrics,
} from './redis-cache-service.js';

export function getCacheConfig(): import('./redis-cache-service.js').RedisCacheConfig {
  return {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: process.env.CACHE_KEY_PREFIX || 'misc-poc:',
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
    enableMetrics: process.env.CACHE_ENABLE_METRICS !== 'false',
  };
}
