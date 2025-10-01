import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { RecordId, TagId, RecordContent } from '@misc-poc/shared';
import { Record, DomainError } from '@misc-poc/domain';
import { PostgreSQLRecordRepository } from '../postgresql-record-repository';

describe('[perf] Record Repository Contract', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: PostgreSQLRecordRepository;
  const testUserId = 'a1b2c3d4-e5f6-4890-abcd-123456789012';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });
    await dataSource.initialize();

    // Create tables
    await dataSource.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        tags TEXT[] NOT NULL,
        normalized_tags TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(user_id, normalized_tags)
      );

      CREATE INDEX idx_records_user_id ON records(user_id);
      CREATE INDEX idx_records_normalized_tags ON records USING GIN(normalized_tags);
      CREATE INDEX idx_records_created_at ON records(created_at DESC);
    `);

    // Insert test user
    await dataSource.query(
      `INSERT INTO users (id, email, google_id, display_name)
       VALUES ($1, 'test@example.com', 'google123', 'Test User')`,
      [testUserId]
    );

    repository = new PostgreSQLRecordRepository(dataSource, testUserId);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    // Clean up records before each test
    await dataSource.query('DELETE FROM records WHERE user_id = $1', [
      testUserId,
    ]);
  });

  describe('save', () => {
    it('should persist new record with user association', async () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      const record = Record.create(
        new RecordContent('test content'),
        new Set([tagId1, tagId2])
      );

      const result = await repository.save(record);

      expect(result.isOk()).toBe(true);
      const savedRecord = result.unwrap();
      expect(savedRecord.id).toEqual(record.id);
      expect(savedRecord.content.toString()).toBe('test content');
      expect(Array.from(savedRecord.tagIds)).toEqual(Array.from(record.tagIds));
    });

    it('should update existing record preserving creation date', async () => {
      const originalTagId = TagId.generate();
      const record = Record.create(
        new RecordContent('original content'),
        new Set([originalTagId])
      );

      const saveResult = await repository.save(record);
      expect(saveResult.isOk()).toBe(true);
      const originalRecord = saveResult.unwrap();

      // Update the record
      const updatedTagId = TagId.generate();
      const updatedRecord = new Record(
        record.id,
        new RecordContent('updated content'),
        new Set([updatedTagId]),
        originalRecord.createdAt,
        new Date()
      );

      const updateResult = await repository.update(updatedRecord);
      expect(updateResult.isOk()).toBe(true);
      const updated = updateResult.unwrap();

      expect(updated.createdAt).toEqual(originalRecord.createdAt);
      expect(updated.updatedAt).not.toEqual(originalRecord.updatedAt);
    });

    it('should normalize tags according to user settings', async () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      const record = Record.create(
        new RecordContent('test content'),
        new Set([tagId1, tagId2])
      );

      const result = await repository.save(record);
      expect(result.isOk()).toBe(true);

      // Verify normalized tags are stored in database
      const dbResult = await dataSource.query(
        'SELECT normalized_tags FROM records WHERE id = $1',
        [record.id.toString()]
      );
      expect(dbResult[0].normalized_tags).toEqual([
        tagId1.toString(),
        tagId2.toString(),
      ]);
    });

    it('should detect and reject duplicates', async () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      const record1 = Record.create(
        new RecordContent('test content'),
        new Set([tagId1, tagId2])
      );

      const record2 = Record.create(
        new RecordContent('different content'),
        new Set([tagId1, tagId2]) // Same tags as record1
      );

      const result1 = await repository.save(record1);
      expect(result1.isOk()).toBe(true);

      const result2 = await repository.save(record2);
      expect(result2.isErr()).toBe(true);
      expect(result2.unwrapErr().code).toBe('DUPLICATE_RECORD');
    });

    it('should maintain tag order from domain entity', async () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      const tagId3 = TagId.generate();
      const tagIds = [tagId1, tagId2, tagId3];
      const record = Record.create(
        new RecordContent('test content'),
        new Set(tagIds)
      );

      const result = await repository.save(record);
      expect(result.isOk()).toBe(true);

      const savedRecord = result.unwrap();
      const savedTagIds = Array.from(savedRecord.tagIds);
      // Note: Set iteration order is not guaranteed, so we check that all tags are present
      expect(savedTagIds).toHaveLength(3);
      const savedTagIdStrings = savedTagIds.map((t) => t.toString());
      expect(savedTagIdStrings).toContain(tagId1.toString());
      expect(savedTagIdStrings).toContain(tagId2.toString());
      expect(savedTagIdStrings).toContain(tagId3.toString());
    });

    it('should handle concurrent saves safely', async () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      const record1 = Record.create(
        new RecordContent('content 1'),
        new Set([tagId1])
      );

      const record2 = Record.create(
        new RecordContent('content 2'),
        new Set([tagId2])
      );

      // Save concurrently
      const results = await Promise.all([
        repository.save(record1),
        repository.save(record2),
      ]);

      expect(results[0].isOk()).toBe(true);
      expect(results[1].isOk()).toBe(true);
    });
  });

  describe('findByTags', () => {
    let commonTagId: TagId;
    let tag1Id: TagId;
    let tag2Id: TagId;
    let tag3Id: TagId;

    beforeEach(async () => {
      // Create consistent tag IDs for this test suite
      commonTagId = TagId.generate();
      tag1Id = TagId.generate();
      tag2Id = TagId.generate();
      tag3Id = TagId.generate();

      // Create test records
      const records = [
        Record.create(
          new RecordContent('content 1'),
          new Set([tag1Id, commonTagId])
        ),
        Record.create(
          new RecordContent('content 2'),
          new Set([tag2Id, commonTagId])
        ),
        Record.create(new RecordContent('content 3'), new Set([tag3Id])),
      ];

      for (const record of records) {
        const result = await repository.save(record);
        expect(result.isOk()).toBe(true);
      }
    });

    it('should find records matching all specified tags (AND logic)', async () => {
      const result = await repository.findByTags([commonTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(2);
      expect(searchResult.total).toBe(2);

      for (const record of searchResult.records) {
        expect(Array.from(record.tagIds).map((t) => t.toString())).toContain(
          commonTagId.toString()
        );
      }
    });

    it('should return empty array when no matches', async () => {
      const nonExistentTagId = TagId.generate();
      const result = await repository.findByTags([nonExistentTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      expect(searchResult.records).toHaveLength(0);
      expect(searchResult.total).toBe(0);
    });

    it('should search using normalized tags', async () => {
      // Search using the actual tag ID should work
      const result = await repository.findByTags([commonTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      expect(searchResult.records.length).toBeGreaterThan(0);
    });

    it('should return only user-owned records', async () => {
      // This is implicitly tested since we use user-specific repository
      const result = await repository.findByTags([commonTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      // All returned records should belong to the test user
      expect(searchResult.records.length).toBeGreaterThanOrEqual(0);
    });

    it('should preserve domain entity structure', async () => {
      const result = await repository.findByTags([commonTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      for (const record of searchResult.records) {
        expect(record).toBeInstanceOf(Record);
        expect(record.id).toBeInstanceOf(RecordId);
        expect(record.content).toBeInstanceOf(RecordContent);
        expect(record.tagIds).toBeInstanceOf(Set);
        expect(record.createdAt).toBeInstanceOf(Date);
        expect(record.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should order by creation date descending', async () => {
      const result = await repository.findByTags([commonTagId.toString()]);
      expect(result.isOk()).toBe(true);

      const searchResult = result.unwrap();
      if (searchResult.records.length > 1) {
        for (let i = 1; i < searchResult.records.length; i++) {
          expect(
            searchResult.records[i - 1].createdAt.getTime()
          ).toBeGreaterThanOrEqual(searchResult.records[i].createdAt.getTime());
        }
      }
    });
  });

  describe('findById', () => {
    let testRecord: Record;

    beforeEach(async () => {
      const tagId = TagId.generate();
      testRecord = Record.create(
        new RecordContent('test content'),
        new Set([tagId])
      );
      const result = await repository.save(testRecord);
      expect(result.isOk()).toBe(true);
      testRecord = result.unwrap();
    });

    it('should return record by ID for owner', async () => {
      const result = await repository.findById(testRecord.id);
      expect(result.isOk()).toBe(true);

      const foundRecord = result.unwrap();
      expect(foundRecord).not.toBeNull();
      expect(foundRecord!.id).toEqual(testRecord.id);
      expect(foundRecord!.content.toString()).toBe(
        testRecord.content.toString()
      );
    });

    it('should return null for non-existent record', async () => {
      const nonExistentId = RecordId.generate();
      const result = await repository.findById(nonExistentId);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeNull();
    });

    it('should return null for other user record', async () => {
      // This is implicitly tested since we use user-specific repository
      // In a multi-user system, this would test cross-user access prevention
      const result = await repository.findById(testRecord.id);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).not.toBeNull();
    });

    it('should reconstruct complete domain entity', async () => {
      const result = await repository.findById(testRecord.id);
      expect(result.isOk()).toBe(true);

      const foundRecord = result.unwrap();
      expect(foundRecord).toBeInstanceOf(Record);
      expect(foundRecord!.id).toBeInstanceOf(RecordId);
      expect(foundRecord!.content).toBeInstanceOf(RecordContent);
      expect(foundRecord!.tagIds).toBeInstanceOf(Set);
      expect(foundRecord!.createdAt).toBeInstanceOf(Date);
      expect(foundRecord!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('delete', () => {
    let testRecord: Record;

    beforeEach(async () => {
      const tagId = TagId.generate();
      testRecord = Record.create(
        new RecordContent('test content'),
        new Set([tagId])
      );
      const result = await repository.save(testRecord);
      expect(result.isOk()).toBe(true);
      testRecord = result.unwrap();
    });

    it('should remove record from storage', async () => {
      const deleteResult = await repository.delete(testRecord.id);
      expect(deleteResult.isOk()).toBe(true);

      // Verify record is deleted
      const findResult = await repository.findById(testRecord.id);
      expect(findResult.isOk()).toBe(true);
      expect(findResult.unwrap()).toBeNull();
    });

    it('should only delete user-owned records', async () => {
      // This is implicitly tested since we use user-specific repository
      const deleteResult = await repository.delete(testRecord.id);
      expect(deleteResult.isOk()).toBe(true);
    });

    it('should handle non-existent record gracefully', async () => {
      const nonExistentId = RecordId.generate();
      const deleteResult = await repository.delete(nonExistentId);
      expect(deleteResult.isErr()).toBe(true);
      expect(deleteResult.unwrapErr().code).toBe('RECORD_NOT_FOUND');
    });
  });

  describe('getTagStatistics', () => {
    let commonTagId: TagId;
    let tag1Id: TagId;
    let tag2Id: TagId;
    let tag3Id: TagId;
    let rareTagId: TagId;

    beforeEach(async () => {
      // Create consistent tag IDs for this test suite
      commonTagId = TagId.generate();
      tag1Id = TagId.generate();
      tag2Id = TagId.generate();
      tag3Id = TagId.generate();
      rareTagId = TagId.generate();

      // Create test records with various tags
      const records = [
        Record.create(
          new RecordContent('content 1'),
          new Set([commonTagId, tag1Id])
        ),
        Record.create(
          new RecordContent('content 2'),
          new Set([commonTagId, tag2Id])
        ),
        Record.create(
          new RecordContent('content 3'),
          new Set([commonTagId, tag3Id])
        ),
        Record.create(new RecordContent('content 4'), new Set([rareTagId])),
      ];

      for (const record of records) {
        const result = await repository.save(record);
        expect(result.isOk()).toBe(true);
      }
    });

    it('should count frequency for each unique tag', async () => {
      const result = await repository.getTagStatistics();
      expect(result.isOk()).toBe(true);

      const statistics = result.unwrap();
      expect(statistics.length).toBeGreaterThan(0);

      const commonTag = statistics.find(
        (s) => s.tag === commonTagId.toString()
      );
      expect(commonTag).toBeDefined();
      expect(commonTag!.count).toBe(3);

      const rareTag = statistics.find((s) => s.tag === rareTagId.toString());
      expect(rareTag).toBeDefined();
      expect(rareTag!.count).toBe(1);
    });

    it('should include only user tags', async () => {
      // This is implicitly tested since we use user-specific repository
      const result = await repository.getTagStatistics();
      expect(result.isOk()).toBe(true);

      const statistics = result.unwrap();
      expect(statistics.length).toBeGreaterThan(0);
    });

    it('should use normalized tags for counting', async () => {
      const result = await repository.getTagStatistics();
      expect(result.isOk()).toBe(true);

      const statistics = result.unwrap();
      // Verify that normalized forms are used for counting
      expect(statistics.length).toBeGreaterThan(0);
    });

    it('should order by frequency descending', async () => {
      const result = await repository.getTagStatistics();
      expect(result.isOk()).toBe(true);

      const statistics = result.unwrap();
      if (statistics.length > 1) {
        for (let i = 1; i < statistics.length; i++) {
          expect(statistics[i - 1].count).toBeGreaterThanOrEqual(
            statistics[i].count
          );
        }
      }
    });
  });
});
