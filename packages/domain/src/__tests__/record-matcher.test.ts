import { RecordMatcher } from '../record-matcher';
import { Record } from '../record';
import { Tag } from '../tag';
import { RecordId, RecordContent, TagId, SearchQuery } from '@misc-poc/shared';

describe('RecordMatcher Domain Service', () => {
  const baseDate = new Date('2023-01-01T00:00:00.000Z');

  // Create test tags
  const tag1 = new Tag(TagId.generate(), 'javascript');
  const tag2 = new Tag(TagId.generate(), 'react');
  const tag3 = new Tag(TagId.generate(), 'typescript');
  const tag4 = new Tag(TagId.generate(), 'programming');

  describe('matches', () => {
    let recordMatcher: RecordMatcher;
    let tagLookup: Map<TagId, Tag>;

    beforeEach(() => {
      tagLookup = new Map();
      tagLookup.set(tag1.id, tag1);
      tagLookup.set(tag2.id, tag2);
      tagLookup.set(tag3.id, tag3);
      tagLookup.set(tag4.id, tag4);

      recordMatcher = new RecordMatcher();
    });

    it('should return true for empty query', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const emptyQuery = new SearchQuery('');

      expect(recordMatcher.matches(record, emptyQuery, tagLookup)).toBe(true);
    });

    it('should return true for query with only whitespace', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const whitespaceQuery = new SearchQuery('   ');

      expect(recordMatcher.matches(record, whitespaceQuery, tagLookup)).toBe(
        true
      );
    });

    it('should match single term against record tags', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });

    it('should match single term with different case', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('JavaScript');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });

    it('should use AND logic for multiple terms', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript react');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });

    it('should return false when one term does not match', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript python');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(false);
    });

    it('should return false when record has no tags and query has terms', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set<TagId>(),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(false);
    });

    it('should handle partial matches correctly', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]), // Only has 'javascript'
        baseDate,
        baseDate
      );
      const query = new SearchQuery('java');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });

    it('should return false for partial matches when full term does not match', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]), // Only has 'javascript'
        baseDate,
        baseDate
      );
      const query = new SearchQuery('python');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(false);
    });

    it('should handle missing tags in lookup gracefully', () => {
      const missingTagId = TagId.generate();
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([missingTagId]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(false);
    });

    it('should handle multiple terms with mixed matches', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag3.id]), // has 'javascript' and 'typescript'
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript react');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(false);
    });

    it('should handle null record gracefully', () => {
      const query = new SearchQuery('javascript');

      expect(recordMatcher.matches(null as any, query, tagLookup)).toBe(false);
    });

    it('should handle null query gracefully', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );

      expect(recordMatcher.matches(record, null as any, tagLookup)).toBe(false);
    });

    it('should handle null tag lookup gracefully', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      expect(recordMatcher.matches(record, query, null as any)).toBe(false);
    });

    it('should handle empty tag lookup', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');
      const emptyLookup = new Map<TagId, Tag>();

      expect(recordMatcher.matches(record, query, emptyLookup)).toBe(false);
    });

    it('should handle complex multi-word queries', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('web development project'),
        new Set([tag1.id, tag2.id, tag4.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript programming');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });

    it('should handle queries with extra whitespace', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('  javascript   react  ');

      expect(recordMatcher.matches(record, query, tagLookup)).toBe(true);
    });
  });

  describe('performance with large tag sets', () => {
    let recordMatcher: RecordMatcher;
    let tagLookup: Map<TagId, Tag>;

    beforeEach(() => {
      recordMatcher = new RecordMatcher();

      // Create a large tag lookup with 1000 tags
      tagLookup = new Map();
      for (let i = 0; i < 1000; i++) {
        const tag = new Tag(TagId.generate(), `tag${i}`);
        tagLookup.set(tag.id, tag);
      }
    });

    it('should efficiently handle records with many tags', () => {
      // Create record with 100 tags
      const manyTagIds = new Set(Array.from(tagLookup.keys()).slice(0, 100));
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        manyTagIds,
        baseDate,
        baseDate
      );
      const query = new SearchQuery('tag1 tag2 tag3');

      const startTime = Date.now();
      const result = recordMatcher.matches(record, query, tagLookup);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should efficiently handle large queries', () => {
      const manyTagIds = new Set(Array.from(tagLookup.keys()).slice(0, 20));
      const record = new Record(
        RecordId.generate(),
        new RecordContent('test content'),
        manyTagIds,
        baseDate,
        baseDate
      );

      // Create query with 15 terms
      const queryTerms = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      const query = new SearchQuery(queryTerms.join(' '));

      const startTime = Date.now();
      const result = recordMatcher.matches(record, query, tagLookup);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('match confidence scoring preparation', () => {
    let recordMatcher: RecordMatcher;
    let tagLookup: Map<TagId, Tag>;

    beforeEach(() => {
      tagLookup = new Map();
      tagLookup.set(tag1.id, tag1);
      tagLookup.set(tag2.id, tag2);
      tagLookup.set(tag3.id, tag3);
      tagLookup.set(tag4.id, tag4);

      recordMatcher = new RecordMatcher();
    });

    it('should return match result structure that can be extended for scoring', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id, tag2.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      const result = recordMatcher.matches(record, query, tagLookup);

      // Basic boolean result for now, but structure allows future enhancement
      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should handle exact matches for future scoring enhancement', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('javascript');

      const result = recordMatcher.matches(record, query, tagLookup);

      expect(result).toBe(true);
    });

    it('should handle partial matches for future scoring enhancement', () => {
      const record = new Record(
        RecordId.generate(),
        new RecordContent('my project'),
        new Set([tag1.id]),
        baseDate,
        baseDate
      );
      const query = new SearchQuery('java');

      const result = recordMatcher.matches(record, query, tagLookup);

      expect(result).toBe(true);
    });
  });
});
