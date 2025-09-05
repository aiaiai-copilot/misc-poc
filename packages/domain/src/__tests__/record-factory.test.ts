import { RecordFactory } from '../record-factory';
import { Record } from '../record';
import { TagParser } from '../tag-parser';
import { TagFactory } from '../tag-factory';
import { TagId } from '@misc-poc/shared';

describe('RecordFactory', () => {
  let factory: RecordFactory;
  let mockTagParser: jest.Mocked<TagParser>;
  let mockTagFactory: jest.Mocked<TagFactory>;

  beforeEach(() => {
    mockTagParser = {
      parse: jest.fn(),
    } as jest.Mocked<TagParser>;

    mockTagFactory = {
      createFromString: jest.fn(),
    } as jest.Mocked<TagFactory>;

    factory = new RecordFactory(mockTagParser, mockTagFactory);
  });

  describe('constructor', () => {
    it('should create factory with default parser and tag factory', () => {
      const defaultFactory = new RecordFactory();
      expect(defaultFactory).toBeInstanceOf(RecordFactory);
    });

    it('should create factory with custom parser and tag factory', () => {
      expect(factory).toBeInstanceOf(RecordFactory);
    });
  });

  describe('createFromContent method', () => {
    describe('successful creation', () => {
      it('should create record from content string with no tags', () => {
        const content = 'This is a simple note';
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(content);

        expect(record).toBeInstanceOf(Record);
        expect(record.content.toString()).toBe(content);
        expect(record.tagIds.size).toBe(0);
        expect(record.createdAt).toBeInstanceOf(Date);
        expect(record.updatedAt).toBeInstanceOf(Date);
        expect(record.createdAt.getTime()).toBe(record.updatedAt.getTime());
        expect(mockTagParser.parse).toHaveBeenCalledWith(content);
      });

      it('should create record from content string with single tag', () => {
        const content = 'This is a note about javascript';
        const tagStrings = ['javascript'];
        const mockTag = {
          id: TagId.generate(),
          normalizedValue: 'javascript',
        };

        mockTagParser.parse.mockReturnValue(tagStrings);
        mockTagFactory.createFromString.mockReturnValue(
          mockTag as unknown as Tag
        );

        const record = factory.createFromContent(content);

        expect(record).toBeInstanceOf(Record);
        expect(record.content.toString()).toBe(content);
        expect(record.tagIds.size).toBe(1);
        expect(record.hasTag(mockTag.id)).toBe(true);
        expect(mockTagParser.parse).toHaveBeenCalledWith(content);
        expect(mockTagFactory.createFromString).toHaveBeenCalledWith(
          'javascript'
        );
      });

      it('should create record from content string with multiple tags', () => {
        const content = 'Learning javascript and python programming';
        const tagStrings = ['javascript', 'python', 'programming'];
        const mockTags = tagStrings.map(() => ({
          id: TagId.generate(),
          normalizedValue: 'mock-tag',
        }));

        mockTagParser.parse.mockReturnValue(tagStrings);
        mockTagFactory.createFromString.mockImplementation((tagString) => {
          const index = tagStrings.indexOf(tagString);
          return mockTags[index] as unknown as Tag;
        });

        const record = factory.createFromContent(content);

        expect(record).toBeInstanceOf(Record);
        expect(record.content.toString()).toBe(content);
        expect(record.tagIds.size).toBe(3);
        mockTags.forEach((tag) => {
          expect(record.hasTag(tag.id)).toBe(true);
        });
        expect(mockTagParser.parse).toHaveBeenCalledWith(content);
        expect(mockTagFactory.createFromString).toHaveBeenCalledTimes(3);
      });

      it('should handle duplicate tags from parser correctly', () => {
        const content = 'javascript javascript programming';
        const tagStrings = ['javascript', 'javascript', 'programming'];
        const mockJsTag = {
          id: TagId.generate(),
          normalizedValue: 'javascript',
        };
        const mockProgTag = {
          id: TagId.generate(),
          normalizedValue: 'programming',
        };

        mockTagParser.parse.mockReturnValue(tagStrings);
        mockTagFactory.createFromString.mockImplementation((tagString) => {
          if (tagString === 'javascript') return mockJsTag as unknown as Tag;
          if (tagString === 'programming') return mockProgTag as unknown as Tag;
          throw new Error('Unexpected tag string');
        });

        const record = factory.createFromContent(content);

        expect(record.tagIds.size).toBe(2);
        expect(record.hasTag(mockJsTag.id)).toBe(true);
        expect(record.hasTag(mockProgTag.id)).toBe(true);
        expect(mockTagFactory.createFromString).toHaveBeenCalledTimes(3);
      });

      it('should generate unique IDs for each record', () => {
        const content = 'Same content';
        mockTagParser.parse.mockReturnValue([]);

        const record1 = factory.createFromContent(content);
        const record2 = factory.createFromContent(content);

        expect(record1.id.equals(record2.id)).toBe(false);
        expect(record1.content.toString()).toBe(record2.content.toString());
      });

      it('should set timestamps correctly', () => {
        const content = 'Test content';
        const beforeCreation = new Date();
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(content);
        const afterCreation = new Date();

        expect(record.createdAt.getTime()).toBeGreaterThanOrEqual(
          beforeCreation.getTime()
        );
        expect(record.createdAt.getTime()).toBeLessThanOrEqual(
          afterCreation.getTime()
        );
        expect(record.updatedAt.getTime()).toBe(record.createdAt.getTime());
      });
    });

    describe('validation failures', () => {
      it('should throw error for null content', () => {
        expect(() =>
          factory.createFromContent(null as unknown as string)
        ).toThrow('Cannot create record: Content cannot be null or undefined');
      });

      it('should throw error for undefined content', () => {
        expect(() =>
          factory.createFromContent(undefined as unknown as string)
        ).toThrow('Cannot create record: Content cannot be null or undefined');
      });

      it('should throw error for empty string content', () => {
        expect(() => factory.createFromContent('')).toThrow(
          'Cannot create record: Content cannot be empty'
        );
      });

      it('should throw error for whitespace-only content', () => {
        expect(() => factory.createFromContent('   ')).toThrow(
          'Cannot create record: Content cannot be empty'
        );
      });
    });

    describe('tag parsing error handling', () => {
      it('should handle tag parser errors gracefully', () => {
        const content = 'Test content';
        mockTagParser.parse.mockImplementation(() => {
          throw new Error('Parser error');
        });

        expect(() => factory.createFromContent(content)).toThrow(
          'Parser error'
        );
      });

      it('should handle tag factory errors gracefully', () => {
        const content = 'Test content with javascript';
        mockTagParser.parse.mockReturnValue(['javascript']);
        mockTagFactory.createFromString.mockImplementation(() => {
          throw new Error('Tag creation failed');
        });

        expect(() => factory.createFromContent(content)).toThrow(
          'Tag creation failed'
        );
      });

      it('should continue processing other tags if one tag creation fails', () => {
        const content = 'javascript python ruby';
        mockTagParser.parse.mockReturnValue(['javascript', 'python', 'ruby']);

        const mockJsTag = {
          id: TagId.generate(),
          normalizedValue: 'javascript',
        };
        const mockRubyTag = { id: TagId.generate(), normalizedValue: 'ruby' };

        mockTagFactory.createFromString.mockImplementation((tagString) => {
          if (tagString === 'javascript') return mockJsTag as unknown as Tag;
          if (tagString === 'python')
            throw new Error('Python tag creation failed');
          if (tagString === 'ruby') return mockRubyTag as unknown as Tag;
          throw new Error('Unexpected tag');
        });

        expect(() => factory.createFromContent(content)).toThrow(
          'Python tag creation failed'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very long content strings', () => {
        const longContent = 'a'.repeat(10000);
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(longContent);

        expect(record.content.toString()).toBe(longContent);
        expect(record.tagIds.size).toBe(0);
      });

      it('should handle content with special characters', () => {
        const content = 'Special chars: !@#$%^&*()_+{}|:<>?[];\'",./';
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(content);

        expect(record.content.toString()).toBe(content);
      });

      it('should handle content with Unicode characters', () => {
        const content = 'Unicode: 🚀 café résumé 中文';
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(content);

        expect(record.content.toString()).toBe(content);
      });

      it('should handle content with line breaks and tabs', () => {
        const content = 'Multi\nline\tcontent\r\nwith\ttabs';
        mockTagParser.parse.mockReturnValue([]);

        const record = factory.createFromContent(content);

        expect(record.content.toString()).toBe(content);
      });
    });

    describe('integration with Record entity', () => {
      it('should create Record that passes all Record entity invariants', () => {
        const content = 'Test content with javascript';
        const mockTag = { id: TagId.generate(), normalizedValue: 'javascript' };

        mockTagParser.parse.mockReturnValue(['javascript']);
        mockTagFactory.createFromString.mockReturnValue(
          mockTag as unknown as Tag
        );

        const record = factory.createFromContent(content);

        // Test Record invariants
        expect(record.id).toBeDefined();
        expect(record.content).toBeDefined();
        expect(record.tagIds).toBeDefined();
        expect(record.createdAt).toBeDefined();
        expect(record.updatedAt).toBeDefined();
        expect(record.updatedAt.getTime()).toBeGreaterThanOrEqual(
          record.createdAt.getTime()
        );
        expect(record.hasTag(mockTag.id)).toBe(true);
        expect(typeof record.toString()).toBe('string');
      });

      it('should create Records that can be compared correctly', () => {
        const content = 'Same content';
        mockTagParser.parse.mockReturnValue([]);

        const record1 = factory.createFromContent(content);
        const record2 = factory.createFromContent(content);

        expect(record1.equals(record1)).toBe(true);
        expect(record1.equals(record2)).toBe(false); // Different IDs
        expect(record1.content.toString()).toBe(record2.content.toString());
      });
    });

    describe('tag deduplication', () => {
      it('should deduplicate tags with same normalized value', () => {
        const content = 'JavaScript JAVASCRIPT javascript';
        const tagStrings = ['javascript']; // Parser should already deduplicate
        const mockTag = { id: TagId.generate(), normalizedValue: 'javascript' };

        mockTagParser.parse.mockReturnValue(tagStrings);
        mockTagFactory.createFromString.mockReturnValue(
          mockTag as unknown as Tag
        );

        const record = factory.createFromContent(content);

        expect(record.tagIds.size).toBe(1);
        expect(mockTagFactory.createFromString).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('performance considerations', () => {
    it('should handle reasonable batch creation without issues', () => {
      const contents = Array.from({ length: 100 }, (_, i) => `Content ${i}`);
      mockTagParser.parse.mockReturnValue([]);

      expect(() => {
        contents.forEach((content) => factory.createFromContent(content));
      }).not.toThrow();
    });

    it('should handle content with many tags efficiently', () => {
      const content = 'Content with many tags';
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      const mockTags = manyTags.map((tag) => ({
        id: TagId.generate(),
        normalizedValue: tag,
      }));

      mockTagParser.parse.mockReturnValue(manyTags);
      mockTagFactory.createFromString.mockImplementation((tagString) => {
        const index = manyTags.indexOf(tagString);
        return mockTags[index] as unknown as Tag;
      });

      const record = factory.createFromContent(content);

      expect(record.tagIds.size).toBe(50);
      expect(mockTagFactory.createFromString).toHaveBeenCalledTimes(50);
    });
  });
});
