import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../data-source.js';
import { PostgreSQLRecordRepository } from '../postgresql-record-repository.js';
import { Record, DomainError } from '@misc-poc/domain';
import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

describe('[perf] PostgreSQL Record Repository Batch Operations Integration Tests', () => {
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
        ['batchtest@example.com', 'batch_test_google_id']
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

  describe('saveBatch with enhanced transaction handling', () => {
    it('[perf] should save multiple records in a single transaction', async () => {
      // Create test records with different tag combinations to avoid duplicates
      const records = [
        new Record(
          new RecordId('11111111-1111-1111-1111-111111111111'),
          new RecordContent('batch record 1'),
          new Set([new TagId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')]),
          new Date('2023-01-01'),
          new Date('2023-01-01')
        ),
        new Record(
          new RecordId('22222222-2222-2222-2222-222222222222'),
          new RecordContent('batch record 2'),
          new Set([new TagId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')]),
          new Date('2023-01-02'),
          new Date('2023-01-02')
        ),
      ];

      const result = await repository.saveBatch(records);

      expect(result.isOk()).toBe(true);
      const savedRecords = result.unwrap();

      expect(savedRecords).toHaveLength(2);

      // Verify all records were saved
      const countResult = await repository.count();
      expect(countResult.isOk()).toBe(true);
      expect(countResult.unwrap()).toBe(2);
    });

    it('[perf] should rollback entire batch if any record fails due to duplicate', async () => {
      // First, create a record that will cause a duplicate conflict
      const existingRecord = new Record(
        new RecordId('44444444-4444-4444-4444-444444444444'),
        new RecordContent('existing record'),
        new Set([new TagId('dddddddd-dddd-dddd-dddd-dddddddddddd')]),
        new Date('2023-01-01'),
        new Date('2023-01-01')
      );

      const saveExistingResult = await repository.save(existingRecord);
      expect(saveExistingResult.isOk()).toBe(true);

      // Now create a batch where one record has same tags (duplicate)
      const batchRecords = [
        new Record(
          new RecordId('55555555-5555-5555-5555-555555555555'),
          new RecordContent('new record 1'),
          new Set([new TagId('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')]),
          new Date('2023-01-02'),
          new Date('2023-01-02')
        ),
        new Record(
          new RecordId('66666666-6666-6666-6666-666666666666'),
          new RecordContent('duplicate record'),
          new Set([new TagId('dddddddd-dddd-dddd-dddd-dddddddddddd')]), // Same tags as existing
          new Date('2023-01-03'),
          new Date('2023-01-03')
        ),
      ];

      const batchResult = await repository.saveBatch(batchRecords);

      expect(batchResult.isErr()).toBe(true);
      const error = batchResult.unwrapErr();
      expect(error.code).toBe('DUPLICATE_RECORD');

      // Verify rollback - only the original record should exist
      const countResult = await repository.count();
      expect(countResult.isOk()).toBe(true);
      expect(countResult.unwrap()).toBe(1);
    });

    it('[perf] should handle empty batch gracefully', async () => {
      const result = await repository.saveBatch([]);

      expect(result.isOk()).toBe(true);
      const savedRecords = result.unwrap();

      expect(savedRecords).toHaveLength(0);

      // Verify no records were affected
      const countResult = await repository.count();
      expect(countResult.unwrap()).toBe(0);
    });
  });

  describe('deleteBatch with transaction safety', () => {
    beforeEach(async () => {
      // Setup test records for deletion tests
      const setupRecords = [
        new Record(
          new RecordId('77777777-7777-4777-8777-777777777777'),
          new RecordContent('setup record 1'),
          new Set([new TagId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')]),
          new Date('2023-01-01'),
          new Date('2023-01-01')
        ),
        new Record(
          new RecordId('88888888-8888-4888-8888-888888888888'),
          new RecordContent('setup record 2'),
          new Set([new TagId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')]),
          new Date('2023-01-02'),
          new Date('2023-01-02')
        ),
        new Record(
          new RecordId('99999999-9999-4999-8999-999999999999'),
          new RecordContent('setup record 3'),
          new Set([new TagId('cccccccc-cccc-4ccc-8ccc-cccccccccccc')]),
          new Date('2023-01-03'),
          new Date('2023-01-03')
        ),
      ];

      const setupResult = await repository.saveBatch(setupRecords);
      expect(setupResult.isOk()).toBe(true);

      // Verify setup worked
      const countAfterSetup = await repository.count();
      expect(countAfterSetup.unwrap()).toBe(3);
    });

    it('[perf] should delete multiple records by ID in a single transaction', async () => {
      const recordIds = [
        new RecordId('77777777-7777-4777-8777-777777777777'),
        new RecordId('88888888-8888-4888-8888-888888888888'),
      ];

      const result = await repository.deleteBatch(recordIds);

      expect(result.isOk()).toBe(true);

      // Verify records were deleted
      const findResult1 = await repository.findById(recordIds[0]);
      const findResult2 = await repository.findById(recordIds[1]);
      expect(findResult1.unwrap()).toBeNull();
      expect(findResult2.unwrap()).toBeNull();

      // Verify third record still exists
      const findResult3 = await repository.findById(
        new RecordId('99999999-9999-4999-8999-999999999999')
      );
      expect(findResult3.unwrap()).not.toBeNull();

      // Verify count
      const countResult = await repository.count();
      expect(countResult.unwrap()).toBe(1);
    });

    it('[perf] should rollback deletion if any record does not exist', async () => {
      const recordIds = [
        new RecordId('77777777-7777-4777-8777-777777777777'), // exists
        new RecordId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), // does not exist
      ];

      const result = await repository.deleteBatch(recordIds);

      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error.code).toBe('RECORD_NOT_FOUND');

      // Verify rollback - all original records should still exist
      const countResult = await repository.count();
      expect(countResult.unwrap()).toBe(3);

      const findResult1 = await repository.findById(recordIds[0]);
      expect(findResult1.unwrap()).not.toBeNull();
    });

    it('[perf] should handle empty batch gracefully', async () => {
      const result = await repository.deleteBatch([]);

      expect(result.isOk()).toBe(true);

      // Verify no records were affected
      const countResult = await repository.count();
      expect(countResult.unwrap()).toBe(3);
    });

    it('[perf] should only delete user-owned records', async () => {
      // Create another user
      const queryRunner = dataSource.createQueryRunner();
      let otherUserId: string;
      try {
        const [otherUserResult] = await queryRunner.query(
          'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
          ['other-delete@example.com', 'other_delete_google_id']
        );
        otherUserId = otherUserResult.id;
      } finally {
        await queryRunner.release();
      }

      const otherRepository = new PostgreSQLRecordRepository(
        dataSource,
        otherUserId
      );

      // Create record for other user with known ID
      const otherUserRecord = new Record(
        new RecordId('aaaaaaaa-1111-4222-8333-444444444444'),
        new RecordContent('other user record'),
        new Set([new TagId('eeeeeeee-1111-4222-8333-444444444444')]),
        new Date('2023-01-01'),
        new Date('2023-01-01')
      );

      const otherSaveResult = await otherRepository.save(otherUserRecord);
      expect(otherSaveResult.isOk()).toBe(true);

      // Try to delete other user's record from main user's repository
      const recordIds = [
        new RecordId('77777777-7777-4777-8777-777777777777'), // own record
        new RecordId('aaaaaaaa-1111-4222-8333-444444444444'), // other user's record
      ];

      const deleteResult = await repository.deleteBatch(recordIds);

      expect(deleteResult.isErr()).toBe(true);
      const error = deleteResult.unwrapErr();
      expect(error.code).toBe('RECORD_NOT_FOUND');

      // Verify other user's record still exists
      const otherFindResult = await otherRepository.findById(
        otherUserRecord.id
      );
      expect(otherFindResult.unwrap()).not.toBeNull();

      // Verify rollback - main user's record should still exist too
      const mainFindResult = await repository.findById(recordIds[0]);
      expect(mainFindResult.unwrap()).not.toBeNull();
    });
  });
});
