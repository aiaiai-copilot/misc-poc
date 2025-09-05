import { Record } from '../record';
import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

describe('Record Entity', () => {
  const recordId = RecordId.generate();
  const content = new RecordContent('test content with tags');
  const tagId1 = TagId.generate();
  const tagId2 = TagId.generate();
  const tagId3 = TagId.generate();
  const tagIds = new Set([tagId1, tagId2]);
  const baseDate = new Date('2023-01-01T00:00:00.000Z');

  describe('constructor', () => {
    it('should create a record with all required properties', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);

      expect(record.id).toBe(recordId);
      expect(record.content).toBe(content);
      expect(record.tagIds).toEqual(tagIds);
      expect(record.createdAt).toBe(baseDate);
      expect(record.updatedAt).toBe(baseDate);
    });

    it('should create a record with different created and updated dates', () => {
      const createdAt = new Date('2023-01-01T00:00:00.000Z');
      const updatedAt = new Date('2023-01-02T00:00:00.000Z');
      const record = new Record(
        recordId,
        content,
        tagIds,
        createdAt,
        updatedAt
      );

      expect(record.createdAt).toBe(createdAt);
      expect(record.updatedAt).toBe(updatedAt);
    });

    it('should throw error when recordId is null', () => {
      expect(() => {
        new Record(
          null as unknown as RecordId,
          content,
          tagIds,
          baseDate,
          baseDate
        );
      }).toThrow('Record ID cannot be null or undefined');
    });

    it('should throw error when recordId is undefined', () => {
      expect(() => {
        new Record(
          undefined as unknown as RecordId,
          content,
          tagIds,
          baseDate,
          baseDate
        );
      }).toThrow('Record ID cannot be null or undefined');
    });

    it('should throw error when content is null', () => {
      expect(() => {
        new Record(
          recordId,
          null as unknown as RecordContent,
          tagIds,
          baseDate,
          baseDate
        );
      }).toThrow('Record content cannot be null or undefined');
    });

    it('should throw error when content is undefined', () => {
      expect(() => {
        new Record(
          recordId,
          undefined as unknown as RecordContent,
          tagIds,
          baseDate,
          baseDate
        );
      }).toThrow('Record content cannot be null or undefined');
    });

    it('should throw error when tagIds is null', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          null as unknown as Set<TagId>,
          baseDate,
          baseDate
        );
      }).toThrow('Tag IDs set cannot be null or undefined');
    });

    it('should throw error when tagIds is undefined', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          undefined as unknown as Set<TagId>,
          baseDate,
          baseDate
        );
      }).toThrow('Tag IDs set cannot be null or undefined');
    });

    it('should throw error when createdAt is null', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          tagIds,
          null as unknown as Date,
          baseDate
        );
      }).toThrow('Created date cannot be null or undefined');
    });

    it('should throw error when createdAt is undefined', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          tagIds,
          undefined as unknown as Date,
          baseDate
        );
      }).toThrow('Created date cannot be null or undefined');
    });

    it('should throw error when updatedAt is null', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          tagIds,
          baseDate,
          null as unknown as Date
        );
      }).toThrow('Updated date cannot be null or undefined');
    });

    it('should throw error when updatedAt is undefined', () => {
      expect(() => {
        new Record(
          recordId,
          content,
          tagIds,
          baseDate,
          undefined as unknown as Date
        );
      }).toThrow('Updated date cannot be null or undefined');
    });

    it('should throw error when updatedAt is before createdAt', () => {
      const createdAt = new Date('2023-01-02T00:00:00.000Z');
      const updatedAt = new Date('2023-01-01T00:00:00.000Z');

      expect(() => {
        new Record(recordId, content, tagIds, createdAt, updatedAt);
      }).toThrow('Updated date cannot be before created date');
    });

    it('should accept when updatedAt equals createdAt', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const record = new Record(recordId, content, tagIds, date, date);

      expect(record.createdAt).toBe(date);
      expect(record.updatedAt).toBe(date);
    });

    it('should create record with empty tag set', () => {
      const emptyTagIds = new Set<TagId>();
      const record = new Record(
        recordId,
        content,
        emptyTagIds,
        baseDate,
        baseDate
      );

      expect(record.tagIds).toEqual(emptyTagIds);
      expect(record.tagIds.size).toBe(0);
    });
  });

  describe('static create', () => {
    it('should create a record with generated id and current timestamps', () => {
      const freezeTime = new Date('2023-01-01T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => freezeTime);

      const record = Record.create(content, tagIds);

      expect(record.id).toBeInstanceOf(RecordId);
      expect(record.content).toBe(content);
      expect(record.tagIds).toEqual(tagIds);
      expect(record.createdAt).toEqual(freezeTime);
      expect(record.updatedAt).toEqual(freezeTime);

      (global.Date as jest.Mock).mockRestore();
    });

    it('should create record with empty tag set', () => {
      const emptyTagIds = new Set<TagId>();
      const record = Record.create(content, emptyTagIds);

      expect(record.tagIds).toEqual(emptyTagIds);
    });
  });

  describe('hasTag', () => {
    const record = new Record(recordId, content, tagIds, baseDate, baseDate);

    it('should return true when record has the tag', () => {
      expect(record.hasTag(tagId1)).toBe(true);
      expect(record.hasTag(tagId2)).toBe(true);
    });

    it('should return false when record does not have the tag', () => {
      expect(record.hasTag(tagId3)).toBe(false);
    });

    it('should handle null tagId gracefully', () => {
      expect(record.hasTag(null as unknown as TagId)).toBe(false);
    });

    it('should handle undefined tagId gracefully', () => {
      expect(record.hasTag(undefined as unknown as TagId)).toBe(false);
    });
  });

  describe('hasSameTagSet', () => {
    const record = new Record(recordId, content, tagIds, baseDate, baseDate);

    it('should return true when both records have identical tag sets', () => {
      const otherRecordId = RecordId.generate();
      const otherContent = new RecordContent('different content');
      const sameTagIds = new Set([tagId1, tagId2]);
      const otherRecord = new Record(
        otherRecordId,
        otherContent,
        sameTagIds,
        baseDate,
        baseDate
      );

      expect(record.hasSameTagSet(otherRecord)).toBe(true);
    });

    it('should return true when both records have empty tag sets', () => {
      const emptyTagIds1 = new Set<TagId>();
      const emptyTagIds2 = new Set<TagId>();
      const record1 = new Record(
        recordId,
        content,
        emptyTagIds1,
        baseDate,
        baseDate
      );
      const record2 = new Record(
        RecordId.generate(),
        content,
        emptyTagIds2,
        baseDate,
        baseDate
      );

      expect(record1.hasSameTagSet(record2)).toBe(true);
    });

    it('should return false when tag sets have different sizes', () => {
      const otherTagIds = new Set([tagId1]); // Only one tag
      const otherRecord = new Record(
        RecordId.generate(),
        content,
        otherTagIds,
        baseDate,
        baseDate
      );

      expect(record.hasSameTagSet(otherRecord)).toBe(false);
    });

    it('should return false when tag sets have same size but different tags', () => {
      const otherTagIds = new Set([tagId1, tagId3]); // Different second tag
      const otherRecord = new Record(
        RecordId.generate(),
        content,
        otherTagIds,
        baseDate,
        baseDate
      );

      expect(record.hasSameTagSet(otherRecord)).toBe(false);
    });

    it('should return false when one record has empty tag set and other has tags', () => {
      const emptyTagIds = new Set<TagId>();
      const emptyRecord = new Record(
        RecordId.generate(),
        content,
        emptyTagIds,
        baseDate,
        baseDate
      );

      expect(record.hasSameTagSet(emptyRecord)).toBe(false);
      expect(emptyRecord.hasSameTagSet(record)).toBe(false);
    });

    it('should handle null other record gracefully', () => {
      expect(record.hasSameTagSet(null as unknown as Record)).toBe(false);
    });

    it('should handle undefined other record gracefully', () => {
      expect(record.hasSameTagSet(undefined as unknown as Record)).toBe(false);
    });
  });

  describe('equals', () => {
    const record = new Record(recordId, content, tagIds, baseDate, baseDate);

    it('should return true when comparing with itself', () => {
      expect(record.equals(record)).toBe(true);
    });

    it('should return true when comparing records with same ID', () => {
      const differentContent = new RecordContent(
        'completely different content'
      );
      const differentTagIds = new Set([tagId3]);
      const differentDates = new Date('2023-12-31T23:59:59.000Z');
      const otherRecord = new Record(
        recordId,
        differentContent,
        differentTagIds,
        differentDates,
        differentDates
      );

      expect(record.equals(otherRecord)).toBe(true);
    });

    it('should return false when comparing records with different IDs', () => {
      const otherRecordId = RecordId.generate();
      const otherRecord = new Record(
        otherRecordId,
        content,
        tagIds,
        baseDate,
        baseDate
      );

      expect(record.equals(otherRecord)).toBe(false);
    });

    it('should return false when comparing with null', () => {
      expect(record.equals(null as unknown as Record)).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      expect(record.equals(undefined as unknown as Record)).toBe(false);
    });

    it('should return false when comparing with non-Record object', () => {
      const notARecord = { id: recordId, content: content };
      expect(record.equals(notARecord as unknown as Record)).toBe(false);
    });
  });

  describe('updateTags', () => {
    it('should update tag IDs and updatedAt timestamp', () => {
      const initialUpdatedAt = new Date('2023-01-01T00:00:00.000Z');
      const record = new Record(
        recordId,
        content,
        tagIds,
        baseDate,
        initialUpdatedAt
      );

      const newTagIds = new Set([tagId2, tagId3]);
      const updateTime = new Date('2023-01-02T12:00:00.000Z');

      jest.spyOn(global, 'Date').mockImplementation(() => updateTime);

      const updatedRecord = record.updateTags(newTagIds);

      expect(updatedRecord.id).toBe(recordId);
      expect(updatedRecord.content).toBe(content);
      expect(updatedRecord.tagIds).toEqual(newTagIds);
      expect(updatedRecord.createdAt).toBe(baseDate);
      expect(updatedRecord.updatedAt).toEqual(updateTime);

      (global.Date as jest.Mock).mockRestore();
    });

    it('should handle empty tag set update', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);
      const emptyTagIds = new Set<TagId>();

      const updatedRecord = record.updateTags(emptyTagIds);

      expect(updatedRecord.tagIds).toEqual(emptyTagIds);
      expect(updatedRecord.tagIds.size).toBe(0);
    });

    it('should return new Record instance (immutability)', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);
      const newTagIds = new Set([tagId3]);

      const updatedRecord = record.updateTags(newTagIds);

      expect(updatedRecord).not.toBe(record);
      expect(record.tagIds).toEqual(tagIds); // Original unchanged
      expect(updatedRecord.tagIds).toEqual(newTagIds);
    });

    it('should throw error when new tagIds is null', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);

      expect(() => {
        record.updateTags(null as unknown as Set<TagId>);
      }).toThrow('Tag IDs set cannot be null or undefined');
    });

    it('should throw error when new tagIds is undefined', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);

      expect(() => {
        record.updateTags(undefined as unknown as Set<TagId>);
      }).toThrow('Tag IDs set cannot be null or undefined');
    });
  });

  describe('toString', () => {
    it('should return string representation with ID and content', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);
      const expectedString = `Record(${recordId.toString()}, ${content.toString()})`;

      expect(record.toString()).toBe(expectedString);
    });
  });

  describe('toJSON', () => {
    it('should return serializable object without internal prefixes', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);
      const json = record.toJSON();

      expect(json).toEqual({
        id: recordId.toString(),
        content: content.toString(),
        tagIds: Array.from(tagIds).map((tagId) => tagId.toString()),
        createdAt: baseDate.toISOString(),
        updatedAt: baseDate.toISOString(),
      });
    });

    it('should handle empty tag set in JSON', () => {
      const emptyTagIds = new Set<TagId>();
      const record = new Record(
        recordId,
        content,
        emptyTagIds,
        baseDate,
        baseDate
      );
      const json = record.toJSON();

      expect(json.tagIds).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal tag set', () => {
      const record = new Record(recordId, content, tagIds, baseDate, baseDate);
      const originalSize = record.tagIds.size;

      // Attempt to modify the returned set should not affect the record
      record.tagIds.add(tagId3);

      expect(record.tagIds.size).toBe(originalSize);
    });
  });

  describe('date handling', () => {
    it('should preserve exact timestamps', () => {
      const createdAt = new Date('2023-01-01T12:34:56.789Z');
      const updatedAt = new Date('2023-01-02T13:45:67.890Z');
      const record = new Record(
        recordId,
        content,
        tagIds,
        createdAt,
        updatedAt
      );

      expect(record.createdAt).toBe(createdAt);
      expect(record.updatedAt).toBe(updatedAt);
      expect(record.createdAt.getTime()).toBe(createdAt.getTime());
      expect(record.updatedAt.getTime()).toBe(updatedAt.getTime());
    });

    it('should handle edge case timestamps', () => {
      const epochStart = new Date(0);
      const farFuture = new Date('2099-12-31T23:59:59.999Z');
      const record = new Record(
        recordId,
        content,
        tagIds,
        epochStart,
        farFuture
      );

      expect(record.createdAt).toBe(epochStart);
      expect(record.updatedAt).toBe(farFuture);
    });
  });
});
