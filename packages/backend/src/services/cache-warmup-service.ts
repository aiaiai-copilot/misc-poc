import { DataSource } from 'typeorm';
import {
  RedisCacheService,
  TagStatistic,
} from '@misc-poc/infrastructure-cache';

interface TagStatsQueryResult {
  tag: string;
  count: string | number;
}

interface TagSuggestionQueryResult {
  tag: string;
  similarity: number;
}

/**
 * Cache warmup service that coordinates between the database and cache.
 * This service contains the business logic for warming up the cache,
 * which requires knowledge of both the data source and cache structure.
 */
export class CacheWarmupService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Batch warm tag statistics for multiple users.
   * Useful for warming cache during off-peak hours or after cache invalidation.
   */
  async batchWarmTagStatistics(userIds: string[]): Promise<void> {
    try {
      for (const userId of userIds) {
        // Query user's tag statistics from database
        const tagStats = await this.dataSource.query(
          `
          SELECT tag, COUNT(*) as count
          FROM user_tags
          WHERE user_id = $1
          GROUP BY tag
          ORDER BY count DESC
        `,
          [userId]
        );

        if (tagStats.length > 0) {
          // Convert count values to numbers to match interface expectations
          const formattedStats: TagStatistic[] = tagStats.map(
            (stat: TagStatsQueryResult) => ({
              tag: stat.tag,
              count:
                typeof stat.count === 'string'
                  ? parseInt(stat.count, 10)
                  : stat.count,
            })
          );
          await this.cacheService.setTagStatistics(userId, formattedStats);
        }
      }
    } catch (error) {
      console.error('Error batch warming tag statistics:', error);
    }
  }

  /**
   * Warm popular tag suggestions for a user.
   * Pre-populates cache with suggestions for common search prefixes.
   */
  async warmPopularTagSuggestions(
    userId: string,
    prefixes: string[]
  ): Promise<void> {
    try {
      for (const prefix of prefixes) {
        // Query suggestions for this prefix
        const suggestions = await this.dataSource.query(
          `
          SELECT DISTINCT tag,
                 similarity(tag, $1) as similarity
          FROM user_tags
          WHERE user_id = $2
            AND tag ILIKE $3
          ORDER BY similarity DESC, tag
          LIMIT 10
        `,
          [prefix, userId, `${prefix}%`]
        );

        if (suggestions.length > 0) {
          const formattedSuggestions = suggestions.map(
            (s: TagSuggestionQueryResult) => ({
              tag: s.tag,
              similarity: s.similarity,
            })
          );
          await this.cacheService.setTagSuggestions(
            userId,
            prefix,
            10,
            formattedSuggestions
          );
        }
      }
    } catch (error) {
      console.error('Error warming popular tag suggestions:', error);
    }
  }

  /**
   * Warm cache for a single user with both statistics and popular suggestions.
   * Useful for warming cache when a user logs in or performs their first action.
   */
  async warmUserCache(
    userId: string,
    popularPrefixes: string[] = ['a', 'b', 'c', 'd', 'e']
  ): Promise<void> {
    await Promise.all([
      this.batchWarmTagStatistics([userId]),
      this.warmPopularTagSuggestions(userId, popularPrefixes),
    ]);
  }
}
