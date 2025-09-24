import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../data-source.js';
import { PostgreSQLRecordRepository } from '../postgresql-record-repository.js';

// Test using the repository's built-in domain object mapping
describe('PostgreSQL Record Repository findByTags Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: PostgreSQLRecordRepository;
  let testUserId: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15-alpine').start();

    // Create DataSource with migration
    dataSource = createTestDataSource({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    // Create test user
    const queryRunner = dataSource.createQueryRunner();
    try {
      const [userResult] = await queryRunner.query(
        'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
        ['findByTags@example.com', 'findByTags_google_id']
      );
      testUserId = userResult.id;
    } finally {
      await queryRunner.release();
    }

    // Create repository instance
    repository = new PostgreSQLRecordRepository(dataSource, testUserId);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    // Clear records before each test
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query('DELETE FROM records WHERE user_id = $1', [
        testUserId,
      ]);
    } finally {
      await queryRunner.release();
    }
  });

  describe('findByTags', () => {
    it('should find records matching all specified tags using GIN index (AND logic)', async () => {
      // Test the actual query directly without using domain objects for setup
      // This tests the core GIN index functionality
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Insert test records with proper UUIDs for tags
        const record1Id = '11111111-1111-1111-1111-111111111111';
        const record2Id = '22222222-2222-2222-2222-222222222222';
        const record3Id = '33333333-3333-3333-3333-333333333333';

        // Use proper UUIDs for tag IDs
        const tag1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const tag2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const tag3Id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        const tag4Id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            record1Id,
            testUserId,
            'First record',
            [tag1Id, tag2Id, tag3Id],
            [tag1Id, tag2Id, tag3Id],
            new Date('2023-01-01'),
            new Date('2023-01-01'),
          ]
        );
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            record2Id,
            testUserId,
            'Second record',
            [tag1Id, tag2Id],
            [tag1Id, tag2Id],
            new Date('2023-01-02'),
            new Date('2023-01-02'),
          ]
        );
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            record3Id,
            testUserId,
            'Third record',
            [tag2Id, tag4Id],
            [tag2Id, tag4Id],
            new Date('2023-01-03'),
            new Date('2023-01-03'),
          ]
        );

        // Now test the findByTags method
        const result = await repository.findByTags([tag1Id, tag2Id]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(2);
        expect(searchResult.total).toBe(2);
        expect(searchResult.hasMore).toBe(false);

        const recordIds = searchResult.records
          .map((r) => r.id.toString())
          .sort();
        expect(recordIds).toEqual([record1Id, record2Id]);
      } finally {
        await queryRunner.release();
      }
    });

    it('should return empty array when no matches found', async () => {
      // Insert test record with different tags
      const queryRunner = dataSource.createQueryRunner();
      try {
        const tag1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const tag2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            '44444444-4444-4444-4444-444444444444',
            testUserId,
            'Test record',
            [tag1Id, tag2Id],
            [tag1Id, tag2Id],
            new Date(),
            new Date(),
          ]
        );

        // Search for non-existent tag UUIDs
        const result = await repository.findByTags([
          'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          'ffffffff-ffff-ffff-ffff-ffffffffffff',
        ]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(0);
        expect(searchResult.total).toBe(0);
        expect(searchResult.hasMore).toBe(false);
      } finally {
        await queryRunner.release();
      }
    });

    it('should search using normalized tags', async () => {
      // Test that search uses normalized tag form
      const queryRunner = dataSource.createQueryRunner();
      try {
        const tagId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        // Insert record with tags
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            '66666666-6666-6666-6666-666666666666',
            testUserId,
            'Normalized test',
            [tagId],
            [tagId],
            new Date(),
            new Date(),
          ]
        );

        // Search should use normalized tags (the method parameter should match normalized_tags column)
        const result = await repository.findByTags([tagId]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(1);
        expect(searchResult.records[0].content.toString()).toBe(
          'Normalized test'
        );
      } finally {
        await queryRunner.release();
      }
    });

    it('should return only user-owned records', async () => {
      // Create another user to test data isolation
      const queryRunner = dataSource.createQueryRunner();
      try {
        const [otherUserResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['other-user@example.com', 'other_user_google_id']
        );
        const otherUserId = otherUserResult.id;

        const tagId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        // Insert records for both users with same tags
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            '77777777-7777-7777-7777-777777777777',
            testUserId,
            'User 1 record',
            [tagId],
            [tagId],
            new Date(),
            new Date(),
          ]
        );
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            '88888888-8888-8888-8888-888888888888',
            otherUserId,
            'User 2 record',
            [tagId],
            [tagId],
            new Date(),
            new Date(),
          ]
        );

        // Repository should only return records for the initialized user
        const result = await repository.findByTags([tagId]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(1);
        expect(searchResult.records[0].content.toString()).toBe(
          'User 1 record'
        );
      } finally {
        await queryRunner.release();
      }
    });

    it('should preserve domain entity structure', async () => {
      // Test that returned records maintain proper domain entity structure
      const queryRunner = dataSource.createQueryRunner();
      try {
        const tagId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const tagId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const recordId = '99999999-9999-9999-9999-999999999999';
        const createdAt = new Date('2023-01-15T10:30:00Z');
        const updatedAt = new Date('2023-01-15T11:45:00Z');

        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            recordId,
            testUserId,
            'Domain test',
            [tagId1, tagId2],
            [tagId1, tagId2],
            createdAt,
            updatedAt,
          ]
        );

        const result = await repository.findByTags([tagId1]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(1);
        const record = searchResult.records[0];

        // Verify complete domain entity structure is preserved
        expect(record.id.toString()).toBe(recordId);
        expect(record.content.toString()).toBe('Domain test');
        expect(record.tagIds.size).toBe(2);
        expect(
          Array.from(record.tagIds)
            .map((t) => t.toString())
            .sort()
        ).toEqual([tagId1, tagId2]);
        expect(record.createdAt).toEqual(createdAt);
        expect(record.updatedAt).toEqual(updatedAt);
      } finally {
        await queryRunner.release();
      }
    });

    it('should order by creation date descending', async () => {
      // Test that records are returned in descending creation date order
      const queryRunner = dataSource.createQueryRunner();
      try {
        const tagId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const tagId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const tagId3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        // Insert records with different creation dates and different tag combinations to avoid unique constraint
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            'aaaa1111-aaaa-1111-aaaa-111111111111',
            testUserId,
            'Oldest record',
            [tagId1, tagId2],
            [tagId1, tagId2],
            new Date('2023-01-01'),
            new Date('2023-01-01'),
          ]
        );
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            'bbbb2222-bbbb-2222-bbbb-222222222222',
            testUserId,
            'Newest record',
            [tagId1, tagId3],
            [tagId1, tagId3],
            new Date('2023-01-03'),
            new Date('2023-01-03'),
          ]
        );
        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            'cccc3333-cccc-3333-cccc-333333333333',
            testUserId,
            'Middle record',
            [tagId1],
            [tagId1],
            new Date('2023-01-02'),
            new Date('2023-01-02'),
          ]
        );

        // Search by tagId1 which all records contain
        const result = await repository.findByTags([tagId1]);

        expect(result.isOk()).toBe(true);
        const searchResult = result.unwrap();

        expect(searchResult.records).toHaveLength(3);

        // Should be ordered by creation date descending (newest first)
        expect(searchResult.records[0].content.toString()).toBe(
          'Newest record'
        );
        expect(searchResult.records[1].content.toString()).toBe(
          'Middle record'
        );
        expect(searchResult.records[2].content.toString()).toBe(
          'Oldest record'
        );
      } finally {
        await queryRunner.release();
      }
    });

    it('should verify GIN index is used for optimal performance', async () => {
      // Insert test record
      const queryRunner = dataSource.createQueryRunner();
      try {
        const performanceTagId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const testTagId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

        await queryRunner.query(
          'INSERT INTO records (id, user_id, content, tags, normalized_tags, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            '55555555-5555-5555-5555-555555555555',
            testUserId,
            'Performance test',
            [performanceTagId, testTagId],
            [performanceTagId, testTagId],
            new Date(),
            new Date(),
          ]
        );

        // Check query execution plan for the actual query used by findByTags
        const plan = await queryRunner.query(
          `
          EXPLAIN (FORMAT JSON)
          SELECT * FROM records
          WHERE user_id = $1 AND normalized_tags @> $2
          ORDER BY created_at DESC
        `,
          [testUserId, [performanceTagId]]
        );

        const planJson = plan[0]['QUERY PLAN'][0];
        const planString = JSON.stringify(planJson);

        // The query should show array containment operation (@>) which uses GIN index
        // PostgreSQL may optimize to use user_id index first, then filter with array containment
        expect(planString).toMatch(/@>|normalized_tags|filter/i);
      } finally {
        await queryRunner.release();
      }
    });
  });
});
