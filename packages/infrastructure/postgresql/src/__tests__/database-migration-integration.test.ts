import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../data-source.js';

describe('Database Migration Integration Tests', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

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
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  describe('Schema Migration', () => {
    it('should run migration successfully', async () => {
      // Run migrations
      await dataSource.runMigrations();

      // Verify all tables were created
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Check if all expected tables exist
        const usersTableExists = await queryRunner.hasTable('users');
        const recordsTableExists = await queryRunner.hasTable('records');
        const userSettingsTableExists =
          await queryRunner.hasTable('user_settings');

        expect(usersTableExists).toBe(true);
        expect(recordsTableExists).toBe(true);
        expect(userSettingsTableExists).toBe(true);

        // Verify users table structure
        const usersTable = await queryRunner.getTable('users');
        expect(usersTable).toBeDefined();

        const emailColumn = usersTable!.findColumnByName('email');
        expect(emailColumn?.isUnique).toBe(true);
        expect(emailColumn?.isNullable).toBe(false);

        const googleIdColumn = usersTable!.findColumnByName('google_id');
        expect(googleIdColumn?.isUnique).toBe(true);
        expect(googleIdColumn?.isNullable).toBe(false);

        // Verify records table structure
        const recordsTable = await queryRunner.getTable('records');
        expect(recordsTable).toBeDefined();

        const userIdFk = recordsTable!.foreignKeys.find(
          (fk) =>
            fk.columnNames.includes('user_id') &&
            fk.referencedTableName === 'users'
        );
        expect(userIdFk).toBeDefined();
        expect(userIdFk!.onDelete).toBe('CASCADE');

        const tagsColumn = recordsTable!.findColumnByName('tags');
        expect(tagsColumn?.isArray).toBe(true);

        const normalizedTagsColumn =
          recordsTable!.findColumnByName('normalized_tags');
        expect(normalizedTagsColumn?.isArray).toBe(true);

        // Verify user_settings table structure
        const userSettingsTable = await queryRunner.getTable('user_settings');
        expect(userSettingsTable).toBeDefined();

        const settingsUserIdFk = userSettingsTable!.foreignKeys.find(
          (fk) =>
            fk.columnNames.includes('user_id') &&
            fk.referencedTableName === 'users'
        );
        expect(settingsUserIdFk).toBeDefined();
        expect(settingsUserIdFk!.onDelete).toBe('CASCADE');

        // Check default values
        const caseSensitiveColumn =
          userSettingsTable!.findColumnByName('case_sensitive');
        expect(caseSensitiveColumn?.default).toBe('false');

        const removeAccentsColumn =
          userSettingsTable!.findColumnByName('remove_accents');
        expect(removeAccentsColumn?.default).toBe('true');
      } finally {
        await queryRunner.release();
      }
    });

    it('should create proper indexes for performance', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Check if indexes exist
        const indexes = await queryRunner.query(`
          SELECT
            indexname,
            indexdef
          FROM pg_indexes
          WHERE tablename = 'records'
          AND schemaname = 'public'
          ORDER BY indexname;
        `);

        const indexNames = indexes.map((idx: any) => idx.indexname);

        expect(indexNames).toContain('idx_records_user_id');
        expect(indexNames).toContain('idx_records_normalized_tags_gin');
        expect(indexNames).toContain('idx_records_created_at');

        // Verify GIN index for array search
        const ginIndex = indexes.find(
          (idx: any) => idx.indexname === 'idx_records_normalized_tags_gin'
        );
        expect(ginIndex?.indexdef).toContain('gin');
        expect(ginIndex?.indexdef).toContain('normalized_tags');
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Data Integrity Constraints', () => {
    beforeEach(async () => {
      // Clear tables before each test
      const queryRunner = dataSource.createQueryRunner();
      try {
        await queryRunner.query(
          'TRUNCATE TABLE user_settings, records, users CASCADE'
        );
      } finally {
        await queryRunner.release();
      }
    });

    it('should enforce email uniqueness in users table', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const testEmail = 'test@example.com';

        // Insert first user
        await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2)',
          [testEmail, 'google_id_1']
        );

        // Attempt to insert second user with same email should fail
        await expect(
          queryRunner.query(
            'INSERT INTO users (email, google_id) VALUES ($1, $2)',
            [testEmail, 'google_id_2']
          )
        ).rejects.toThrow();
      } finally {
        await queryRunner.release();
      }
    });

    it('should enforce google_id uniqueness in users table', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const testGoogleId = 'unique_google_id';

        // Insert first user
        await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2)',
          ['test1@example.com', testGoogleId]
        );

        // Attempt to insert second user with same google_id should fail
        await expect(
          queryRunner.query(
            'INSERT INTO users (email, google_id) VALUES ($1, $2)',
            ['test2@example.com', testGoogleId]
          )
        ).rejects.toThrow();
      } finally {
        await queryRunner.release();
      }
    });

    it('should enforce unique normalized_tags per user in records table', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Create a test user first
        const [userResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['test@example.com', 'test_google_id']
        );
        const userId = userResult.id;

        const testTags = ['tag1', 'tag2'];

        // Insert first record
        await queryRunner.query(
          'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
          [userId, 'First content', testTags, testTags]
        );

        // Attempt to insert second record with same normalized_tags should fail
        await expect(
          queryRunner.query(
            'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
            [userId, 'Second content', testTags, testTags]
          )
        ).rejects.toThrow();
      } finally {
        await queryRunner.release();
      }
    });

    it('should allow same normalized_tags for different users', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Create two test users
        const [user1Result] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['user1@example.com', 'google_id_1']
        );
        const [user2Result] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['user2@example.com', 'google_id_2']
        );

        const user1Id = user1Result.id;
        const user2Id = user2Result.id;
        const testTags = ['shared', 'tags'];

        // Both inserts should succeed
        await expect(
          queryRunner.query(
            'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
            [user1Id, 'User 1 content', testTags, testTags]
          )
        ).resolves.not.toThrow();

        await expect(
          queryRunner.query(
            'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
            [user2Id, 'User 2 content', testTags, testTags]
          )
        ).resolves.not.toThrow();
      } finally {
        await queryRunner.release();
      }
    });

    it('should enforce one-to-one relationship between users and user_settings', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Create a test user
        const [userResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['settings@example.com', 'settings_google_id']
        );
        const userId = userResult.id;

        // Insert settings for user
        await queryRunner.query(
          'INSERT INTO user_settings (user_id) VALUES ($1)',
          [userId]
        );

        // Attempt to insert second settings record for same user should fail
        await expect(
          queryRunner.query('INSERT INTO user_settings (user_id) VALUES ($1)', [
            userId,
          ])
        ).rejects.toThrow();
      } finally {
        await queryRunner.release();
      }
    });

    it('should use correct default values in user_settings', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Create a test user
        const [userResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['defaults@example.com', 'defaults_google_id']
        );
        const userId = userResult.id;

        // Insert settings with defaults
        await queryRunner.query(
          'INSERT INTO user_settings (user_id) VALUES ($1)',
          [userId]
        );

        // Verify default values
        const [settings] = await queryRunner.query(
          'SELECT * FROM user_settings WHERE user_id = $1',
          [userId]
        );

        expect(settings.case_sensitive).toBe(false);
        expect(settings.remove_accents).toBe(true);
        expect(settings.max_tag_length).toBe(100);
        expect(settings.max_tags_per_record).toBe(50);
        expect(settings.ui_language).toBe('en');
        expect(settings.created_at).toBeDefined();
        expect(settings.updated_at).toBeDefined();
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Array Search Performance', () => {
    it('should optimize tag search using GIN index', async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        // Create a test user and records
        const [userResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['perf@example.com', 'perf_google_id']
        );
        const userId = userResult.id;

        // Insert test records
        await queryRunner.query(
          'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
          [userId, 'Content 1', ['tag1', 'tag2'], ['tag1', 'tag2']]
        );
        await queryRunner.query(
          'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
          [userId, 'Content 2', ['tag2', 'tag3'], ['tag2', 'tag3']]
        );
        await queryRunner.query(
          'INSERT INTO records (user_id, content, tags, normalized_tags) VALUES ($1, $2, $3, $4)',
          [userId, 'Content 3', ['tag3', 'tag4'], ['tag3', 'tag4']]
        );

        // Test array search using && operator (overlaps)
        const overlapResult = await queryRunner.query(
          `
          SELECT * FROM records
          WHERE user_id = $1
          AND normalized_tags && $2
          ORDER BY created_at
        `,
          [userId, ['tag2']]
        );

        expect(overlapResult).toHaveLength(2);
        expect(overlapResult[0].content).toBe('Content 1');
        expect(overlapResult[1].content).toBe('Content 2');

        // Test array search using @> operator (contains)
        const containsResult = await queryRunner.query(
          `
          SELECT * FROM records
          WHERE user_id = $1
          AND normalized_tags @> $2
          ORDER BY created_at
        `,
          [userId, ['tag1', 'tag2']]
        );

        expect(containsResult).toHaveLength(1);
        expect(containsResult[0].content).toBe('Content 1');

        // Test array search using <@ operator (is contained by)
        const containedByResult = await queryRunner.query(
          `
          SELECT * FROM records
          WHERE user_id = $1
          AND $2 <@ normalized_tags
          ORDER BY created_at
        `,
          [userId, ['tag2']]
        );

        expect(containedByResult).toHaveLength(2);
      } finally {
        await queryRunner.release();
      }
    });
  });
});
