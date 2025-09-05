import { RecordDuplicateChecker } from '../record-duplicate-checker';
import { Record } from '../record';
import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

describe('RecordDuplicateChecker Domain Service', () => {
  const tagId1 = TagId.generate();
  const tagId2 = TagId.generate();
  const tagId3 = TagId.generate();
  const baseDate = new Date('2023-01-01T00:00:00.000Z');

  describe('isDuplicate', () => {
    let duplicateChecker: RecordDuplicateChecker;

    beforeEach(() => {
      duplicateChecker = new RecordDuplicateChecker();
    });

    it('should return true when two records have identical tag sets', () => {
      const tagIds = new Set([tagId1, tagId2]);
      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('first content'),
        tagIds,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('second content'),
        tagIds,
        baseDate,
        baseDate
      );

      expect(duplicateChecker.isDuplicate(record1, record2)).toBe(true);
    });

    it('should return true when tag sets contain same tags in different order', () => {
      const tagIds1 = new Set([tagId1, tagId2]);
      const tagIds2 = new Set([tagId2, tagId1]); // Same tags, different insertion order

      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('first content'),
        tagIds1,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('second content'),
        tagIds2,
        baseDate,
        baseDate
      );

      expect(duplicateChecker.isDuplicate(record1, record2)).toBe(true);
    });

    it('should return false when records have different tag sets', () => {
      const tagIds1 = new Set([tagId1, tagId2]);
      const tagIds2 = new Set([tagId1, tagId3]); // Different second tag

      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('first content'),
        tagIds1,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('second content'),
        tagIds2,
        baseDate,
        baseDate
      );

      expect(duplicateChecker.isDuplicate(record1, record2)).toBe(false);
    });

    it('should return false when one record has empty tag set and other has tags', () => {
      const emptyTagIds = new Set<TagId>();
      const nonEmptyTagIds = new Set([tagId1]);

      const emptyRecord = new Record(
        RecordId.generate(),
        new RecordContent('empty tags content'),
        emptyTagIds,
        baseDate,
        baseDate
      );
      const nonEmptyRecord = new Record(
        RecordId.generate(),
        new RecordContent('non-empty tags content'),
        nonEmptyTagIds,
        baseDate,
        baseDate
      );

      expect(duplicateChecker.isDuplicate(emptyRecord, nonEmptyRecord)).toBe(
        false
      );
      expect(duplicateChecker.isDuplicate(nonEmptyRecord, emptyRecord)).toBe(
        false
      );
    });

    it('should return true when both records have empty tag sets', () => {
      const emptyTagIds1 = new Set<TagId>();
      const emptyTagIds2 = new Set<TagId>();

      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('first empty content'),
        emptyTagIds1,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('second empty content'),
        emptyTagIds2,
        baseDate,
        baseDate
      );

      expect(duplicateChecker.isDuplicate(record1, record2)).toBe(true);
    });

    it('should return false when records have tag sets of different sizes', () => {
      const singleTagIds = new Set([tagId1]);
      const doubleTagIds = new Set([tagId1, tagId2]);

      const singleTagRecord = new Record(
        RecordId.generate(),
        new RecordContent('single tag content'),
        singleTagIds,
        baseDate,
        baseDate
      );
      const doubleTagRecord = new Record(
        RecordId.generate(),
        new RecordContent('double tag content'),
        doubleTagIds,
        baseDate,
        baseDate
      );

      expect(
        duplicateChecker.isDuplicate(singleTagRecord, doubleTagRecord)
      ).toBe(false);
    });

    it('should handle null record1 gracefully', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        new Set([tagId1]),
        baseDate,
        baseDate
      );

      expect(
        duplicateChecker.isDuplicate(null as unknown as Record, record)
      ).toBe(false);
    });

    it('should handle null record2 gracefully', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        new Set([tagId1]),
        baseDate,
        baseDate
      );

      expect(
        duplicateChecker.isDuplicate(record, null as unknown as Record)
      ).toBe(false);
    });

    it('should handle both records being null', () => {
      expect(
        duplicateChecker.isDuplicate(
          null as unknown as Record,
          null as unknown as Record
        )
      ).toBe(false);
    });

    it('should handle undefined records gracefully', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        new Set([tagId1]),
        baseDate,
        baseDate
      );

      expect(
        duplicateChecker.isDuplicate(undefined as unknown as Record, record)
      ).toBe(false);
      expect(
        duplicateChecker.isDuplicate(record, undefined as unknown as Record)
      ).toBe(false);
      expect(
        duplicateChecker.isDuplicate(
          undefined as unknown as Record,
          undefined as unknown as Record
        )
      ).toBe(false);
    });
  });

  describe('findDuplicatesIn', () => {
    let duplicateChecker: RecordDuplicateChecker;

    beforeEach(() => {
      duplicateChecker = new RecordDuplicateChecker();
    });

    it('should return empty array when no duplicates exist', () => {
      const tagIds1 = new Set([tagId1]);
      const tagIds2 = new Set([tagId2]);
      const tagIds3 = new Set([tagId3]);

      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('content1'),
        tagIds1,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('content2'),
        tagIds2,
        baseDate,
        baseDate
      );
      const record3 = new Record(
        RecordId.generate(),
        new RecordContent('content3'),
        tagIds3,
        baseDate,
        baseDate
      );

      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        new Set([tagId1, tagId2]),
        baseDate,
        baseDate
      );
      const records = [record1, record2, record3];

      expect(duplicateChecker.findDuplicatesIn(targetRecord, records)).toEqual(
        []
      );
    });

    it('should return records that are duplicates of target record', () => {
      const sharedTagIds = new Set([tagId1, tagId2]);
      const differentTagIds = new Set([tagId3]);

      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const duplicate1 = new Record(
        RecordId.generate(),
        new RecordContent('dup1'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const duplicate2 = new Record(
        RecordId.generate(),
        new RecordContent('dup2'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const nonDuplicate = new Record(
        RecordId.generate(),
        new RecordContent('different'),
        differentTagIds,
        baseDate,
        baseDate
      );

      const records = [duplicate1, nonDuplicate, duplicate2];

      const result = duplicateChecker.findDuplicatesIn(targetRecord, records);

      expect(result).toHaveLength(2);
      expect(result).toContain(duplicate1);
      expect(result).toContain(duplicate2);
      expect(result).not.toContain(nonDuplicate);
    });

    it('should exclude target record itself from results when present in collection', () => {
      const sharedTagIds = new Set([tagId1, tagId2]);

      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const duplicate = new Record(
        RecordId.generate(),
        new RecordContent('duplicate'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const nonDuplicate = new Record(
        RecordId.generate(),
        new RecordContent('different'),
        new Set([tagId3]),
        baseDate,
        baseDate
      );

      const records = [targetRecord, duplicate, nonDuplicate]; // Target record included in collection

      const result = duplicateChecker.findDuplicatesIn(targetRecord, records);

      expect(result).toHaveLength(1);
      expect(result).toContain(duplicate);
      expect(result).not.toContain(targetRecord); // Should not include itself
      expect(result).not.toContain(nonDuplicate);
    });

    it('should handle empty records collection', () => {
      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        new Set([tagId1]),
        baseDate,
        baseDate
      );
      const records: Record[] = [];

      expect(duplicateChecker.findDuplicatesIn(targetRecord, records)).toEqual(
        []
      );
    });

    it('should handle null target record', () => {
      const records = [
        new Record(
          RecordId.generate(),
          new RecordContent('content'),
          new Set([tagId1]),
          baseDate,
          baseDate
        ),
      ];

      expect(
        duplicateChecker.findDuplicatesIn(null as unknown as Record, records)
      ).toEqual([]);
    });

    it('should handle null records collection', () => {
      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        new Set([tagId1]),
        baseDate,
        baseDate
      );

      expect(
        duplicateChecker.findDuplicatesIn(
          targetRecord,
          null as unknown as Record[]
        )
      ).toEqual([]);
    });

    it('should handle records collection with null entries', () => {
      const sharedTagIds = new Set([tagId1, tagId2]);

      const targetRecord = new Record(
        RecordId.generate(),
        new RecordContent('target'),
        sharedTagIds,
        baseDate,
        baseDate
      );
      const duplicate = new Record(
        RecordId.generate(),
        new RecordContent('duplicate'),
        sharedTagIds,
        baseDate,
        baseDate
      );

      const records = [null, duplicate, null] as unknown as Record[];

      const result = duplicateChecker.findDuplicatesIn(targetRecord, records);

      expect(result).toHaveLength(1);
      expect(result).toContain(duplicate);
    });
  });

  describe('performance with large tag sets', () => {
    let duplicateChecker: RecordDuplicateChecker;

    beforeEach(() => {
      duplicateChecker = new RecordDuplicateChecker();
    });

    it('should efficiently handle records with many tags', () => {
      // Create two records with 100 identical tags
      const manyTags = new Set(
        Array.from({ length: 100 }, () => TagId.generate())
      );

      const record1 = new Record(
        RecordId.generate(),
        new RecordContent('first content'),
        manyTags,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        new RecordContent('second content'),
        manyTags,
        baseDate,
        baseDate
      );

      const startTime = Date.now();
      const result = duplicateChecker.isDuplicate(record1, record2);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
