import { LovableRecordAdapter, LovableRecord } from '../lovable-record-adapter';
import { RecordDTO } from '../../dtos/record-dto';

describe('LovableRecordAdapter', () => {
  describe('toLovableRecord', () => {
    it('should convert RecordDTO to LovableRecord', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: 'tag1 tag2 tag3',
        tagIds: ['1', '2', '3'],
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z',
        metadata: {
          source: 'test',
          version: 1
        }
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result).toEqual({
        id: '123',
        tags: ['tag1', 'tag2', 'tag3'],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      });
    });

    it('should handle empty content (no tags)', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: '',
        tagIds: [],
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result).toEqual({
        id: '123',
        tags: [],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      });
    });

    it('should handle content with extra whitespace', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: '  tag1   tag2    tag3  ',
        tagIds: ['1', '2', '3'],
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle special characters in tags', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: 'tag-with-dash tag_with_underscore tag.with.dots',
        tagIds: ['1', '2', '3'],
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result.tags).toEqual(['tag-with-dash', 'tag_with_underscore', 'tag.with.dots']);
    });

    it('should handle invalid date strings gracefully', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: 'tag1',
        tagIds: ['1'],
        createdAt: 'invalid-date',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      expect(() => {
        LovableRecordAdapter.toLovableRecord(recordDTO);
      }).toThrow('Invalid date string: invalid-date');
    });
  });

  describe('toRecordDTO', () => {
    it('should convert LovableRecord to RecordDTO', () => {
      const lovableRecord: LovableRecord = {
        id: '123',
        tags: ['tag1', 'tag2', 'tag3'],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      };

      const result = LovableRecordAdapter.toRecordDTO(lovableRecord);

      expect(result).toEqual({
        id: '123',
        content: 'tag1 tag2 tag3',
        tagIds: [], // Empty array since we don't have TagId mapping in Lovable format
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      });
    });

    it('should handle empty tags array', () => {
      const lovableRecord: LovableRecord = {
        id: '123',
        tags: [],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      };

      const result = LovableRecordAdapter.toRecordDTO(lovableRecord);

      expect(result.content).toBe('');
      expect(result.tagIds).toEqual([]);
    });

    it('should handle tags with spaces by filtering them out', () => {
      const lovableRecord: LovableRecord = {
        id: '123',
        tags: ['tag1', 'tag with space', 'tag2'],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      };

      const result = LovableRecordAdapter.toRecordDTO(lovableRecord);

      // Should filter out tags with spaces to maintain data integrity
      expect(result.content).toBe('tag1 tag2');
    });

    it('should handle special characters in tags', () => {
      const lovableRecord: LovableRecord = {
        id: '123',
        tags: ['tag-with-dash', 'tag_with_underscore', 'tag.with.dots'],
        createdAt: new Date('2023-01-01T12:00:00.000Z'),
        updatedAt: new Date('2023-01-02T12:00:00.000Z')
      };

      const result = LovableRecordAdapter.toRecordDTO(lovableRecord);

      expect(result.content).toBe('tag-with-dash tag_with_underscore tag.with.dots');
    });
  });

  describe('edge cases', () => {
    it('should handle round-trip conversion maintaining data integrity', () => {
      const originalDTO: RecordDTO = {
        id: '123',
        content: 'tag1 tag2 tag3',
        tagIds: ['1', '2', '3'], // This will be lost in round-trip since LovableRecord doesn't track tagIds
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const lovableRecord = LovableRecordAdapter.toLovableRecord(originalDTO);
      const backToDTO = LovableRecordAdapter.toRecordDTO(lovableRecord);

      // Should preserve core data but tagIds will be empty
      expect(backToDTO.id).toBe(originalDTO.id);
      expect(backToDTO.content).toBe(originalDTO.content);
      expect(backToDTO.createdAt).toBe(originalDTO.createdAt);
      expect(backToDTO.updatedAt).toBe(originalDTO.updatedAt);
      expect(backToDTO.tagIds).toEqual([]); // Expected loss of tagIds
    });

    it('should handle unicode characters in tags', () => {
      const recordDTO: RecordDTO = {
        id: '123',
        content: 'tag1 тег2 标签3',
        tagIds: ['1', '2', '3'],
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result.tags).toEqual(['tag1', 'тег2', '标签3']);
    });

    it('should handle very large number of tags', () => {
      const manyTags = Array.from({ length: 1000 }, (_, i) => `tag${i}`);
      const recordDTO: RecordDTO = {
        id: '123',
        content: manyTags.join(' '),
        tagIds: manyTags.map(String),
        createdAt: '2023-01-01T12:00:00.000Z',
        updatedAt: '2023-01-02T12:00:00.000Z'
      };

      const result = LovableRecordAdapter.toLovableRecord(recordDTO);

      expect(result.tags).toEqual(manyTags);
      expect(result.tags).toHaveLength(1000);
    });
  });

  describe('type conversion utilities', () => {
    it('should convert string array to space-separated content', () => {
      const tags = ['tag1', 'tag2', 'tag3'];
      const result = LovableRecordAdapter.tagsToContent(tags);
      expect(result).toBe('tag1 tag2 tag3');
    });

    it('should convert space-separated content to string array', () => {
      const content = 'tag1 tag2 tag3';
      const result = LovableRecordAdapter.contentToTags(content);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse date string to Date object', () => {
      const dateString = '2023-01-01T12:00:00.000Z';
      const result = LovableRecordAdapter.parseDate(dateString);
      expect(result).toEqual(new Date('2023-01-01T12:00:00.000Z'));
    });

    it('should format Date object to ISO string', () => {
      const date = new Date('2023-01-01T12:00:00.000Z');
      const result = LovableRecordAdapter.formatDate(date);
      expect(result).toBe('2023-01-01T12:00:00.000Z');
    });
  });
});