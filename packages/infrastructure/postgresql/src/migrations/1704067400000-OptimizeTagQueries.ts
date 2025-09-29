import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Migration: Optimize Tag Queries and Indexing (Task 10.3)
 *
 * This migration implements efficient PostgreSQL queries with proper indexing
 * for tag operations based on PRD performance requirements:
 * - Tag Statistics: < 500ms
 * - Search (up to 10k records): < 200ms
 * - Prefix matching optimization for auto-completion
 * - User-specific query optimization
 *
 * Key optimizations:
 * 1. Enhanced GIN index configuration for better performance
 * 2. Composite index for user-specific tag queries
 * 3. Optimized index for ordering queries (created_at DESC)
 * 4. Optional trigram extension support for prefix matching
 */
export class OptimizeTagQueries1704067400000 implements MigrationInterface {
  name = 'OptimizeTagQueries1704067400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop existing basic GIN index to recreate with optimizations
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_records_normalized_tags_gin;'
    );

    // Step 2: Create optimized GIN index with better configuration
    // Using WITH (fastupdate = off) for better query performance at the cost of slower inserts
    // This is optimal for read-heavy workloads like tag statistics and search
    await queryRunner.query(`
      CREATE INDEX idx_records_normalized_tags_gin ON records
      USING GIN(normalized_tags)
      WITH (fastupdate = off);
    `);

    // Step 3: Create composite index for user-specific tag queries
    // This index optimizes the common pattern: user_id filter + tag operations + ordering by created_at
    // INCLUDE clause allows index-only scans for normalized_tags without storing them in the index tree
    await queryRunner.createIndex(
      'records',
      new TableIndex({
        name: 'idx_records_user_tags_composite',
        columnNames: ['user_id', 'created_at'],
        where: undefined, // No partial index condition
      })
    );

    // Add the INCLUDE clause manually since TypeORM doesn't support it directly
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_records_user_tags_composite;
      CREATE INDEX idx_records_user_tags_composite ON records(user_id, created_at DESC)
      INCLUDE (normalized_tags);
    `);

    // Step 4: Optimize existing created_at index for better DESC ordering performance
    await queryRunner.query('DROP INDEX IF EXISTS idx_records_created_at;');
    await queryRunner.query(`
      CREATE INDEX idx_records_created_at ON records(created_at DESC NULLS LAST);
    `);

    // Step 5: Create specialized index for tag frequency calculations
    // This helps with the tag statistics queries that use unnest(normalized_tags)
    await queryRunner.query(`
      CREATE INDEX idx_records_user_tag_freq ON records(user_id)
      INCLUDE (normalized_tags);
    `);

    // Step 6: Add trigram extension for advanced prefix matching (if available)
    // This is optional and will silently fail if the extension is not available
    try {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

      // Create GIN trigram index for faster LIKE operations in prefix matching
      await queryRunner.query(`
        CREATE INDEX idx_records_normalized_tags_trgm ON records
        USING GIN(normalized_tags gin_trgm_ops);
      `);
    } catch {
      // Extension not available, continue without trigram optimization
      console.log(
        'pg_trgm extension not available, skipping trigram index creation'
      );
    }

    // Step 7: Update table statistics to help query planner make better decisions
    await queryRunner.query('ANALYZE records;');

    // Step 8: Set optimal PostgreSQL configuration for GIN operations
    // These settings optimize GIN index performance for our use case
    await queryRunner.query(`
      -- Increase work_mem for better sort performance in tag statistics
      ALTER DATABASE ${queryRunner.connection.options.database}
      SET default_statistics_target = 1000;
    `);

    // Step 9: Create function for optimized tag statistics calculation
    // This function uses optimized SQL for better performance
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_user_tag_statistics(p_user_id UUID)
      RETURNS TABLE(tag TEXT, count BIGINT) AS $$
      BEGIN
        RETURN QUERY
        WITH tag_expansion AS (
          SELECT unnest(normalized_tags) as tag_name
          FROM records
          WHERE user_id = p_user_id
        )
        SELECT
          tag_name as tag,
          COUNT(*) as count
        FROM tag_expansion
        GROUP BY tag_name
        ORDER BY count DESC, tag_name ASC;
      END;
      $$ LANGUAGE plpgsql
      STABLE -- Function is stable for better optimization
      PARALLEL SAFE; -- Allow parallel execution
    `);

    // Step 10: Create function for optimized prefix matching
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_user_tag_suggestions(p_user_id UUID, p_prefix TEXT, p_limit INTEGER DEFAULT 10)
      RETURNS TABLE(tag TEXT) AS $$
      BEGIN
        RETURN QUERY
        WITH user_tag_freq AS (
          SELECT unnest(normalized_tags) as tag_name, COUNT(*) as frequency
          FROM records
          WHERE user_id = p_user_id
          GROUP BY unnest(normalized_tags)
        )
        SELECT tag_name as tag
        FROM user_tag_freq
        WHERE tag_name ILIKE (p_prefix || '%')
        ORDER BY frequency DESC, tag_name ASC
        LIMIT p_limit;
      END;
      $$ LANGUAGE plpgsql
      STABLE
      PARALLEL SAFE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop the optimized functions
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS get_user_tag_suggestions(UUID, TEXT, INTEGER);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS get_user_tag_statistics(UUID);'
    );

    // Step 2: Drop specialized indexes
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_records_normalized_tags_trgm;'
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_records_user_tag_freq;');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_records_user_tags_composite;'
    );

    // Step 3: Restore original created_at index
    await queryRunner.query('DROP INDEX IF EXISTS idx_records_created_at;');
    await queryRunner.query(
      'CREATE INDEX idx_records_created_at ON records(created_at DESC);'
    );

    // Step 4: Restore original basic GIN index
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_records_normalized_tags_gin;'
    );
    await queryRunner.query(
      'CREATE INDEX idx_records_normalized_tags_gin ON records USING GIN(normalized_tags);'
    );

    // Step 5: Reset database configuration
    await queryRunner.query(`
      ALTER DATABASE ${queryRunner.connection.options.database}
      RESET default_statistics_target;
    `);

    // Step 6: Update statistics after index changes
    await queryRunner.query('ANALYZE records;');
  }
}
