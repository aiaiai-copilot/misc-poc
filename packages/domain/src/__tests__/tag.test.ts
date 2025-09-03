import { Tag } from '../tag';
import { TagId } from '@misc-poc/shared';

describe('Tag', () => {
  describe('constructor', () => {
    it('should create Tag with TagId and normalized value', () => {
      const tagId = TagId.generate();
      const normalizedValue = 'javascript';

      const tag = new Tag(tagId, normalizedValue);

      expect(tag.id).toBe(tagId);
      expect(tag.normalizedValue).toBe(normalizedValue);
    });

    it('should throw error for null or undefined id', () => {
      expect(() => new Tag(null as any, 'javascript')).toThrow(
        'Tag ID cannot be null or undefined'
      );
      expect(() => new Tag(undefined as any, 'javascript')).toThrow(
        'Tag ID cannot be null or undefined'
      );
    });

    it('should throw error for null or undefined normalizedValue', () => {
      const tagId = TagId.generate();

      expect(() => new Tag(tagId, null as any)).toThrow(
        'Normalized value cannot be null or undefined'
      );
      expect(() => new Tag(tagId, undefined as any)).toThrow(
        'Normalized value cannot be null or undefined'
      );
    });

    it('should throw error for empty normalizedValue', () => {
      const tagId = TagId.generate();

      expect(() => new Tag(tagId, '')).toThrow(
        'Normalized value cannot be empty'
      );
    });

    it('should throw error for normalizedValue with whitespace', () => {
      const tagId = TagId.generate();
      const valuesWithWhitespace = [
        'java script',
        ' javascript',
        'javascript ',
        'java\tscript',
        'java\nscript',
      ];

      valuesWithWhitespace.forEach((value) => {
        expect(() => new Tag(tagId, value)).toThrow(
          'Normalized value cannot contain whitespace'
        );
      });
    });

    it('should accept valid normalized values', () => {
      const tagId = TagId.generate();
      const validValues = [
        'javascript',
        'html5',
        'node-js',
        'c++',
        'asp.net',
        'vue.js',
        'test_case',
      ];

      validValues.forEach((value) => {
        expect(() => new Tag(tagId, value)).not.toThrow();
      });
    });
  });

  describe('create factory method', () => {
    it('should create Tag with auto-generated id and normalized value', () => {
      const normalizedValue = 'javascript';

      const tag = Tag.create(normalizedValue);

      expect(tag.id).toBeInstanceOf(TagId);
      expect(tag.normalizedValue).toBe(normalizedValue);
    });

    it('should generate unique ids for different tags', () => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('python');

      expect(tag1.id.equals(tag2.id)).toBe(false);
    });

    it('should validate normalized value same as constructor', () => {
      expect(() => Tag.create('')).toThrow('Normalized value cannot be empty');
      expect(() => Tag.create('java script')).toThrow(
        'Normalized value cannot contain whitespace'
      );
    });
  });

  describe('equals method', () => {
    it('should return true for tags with same id', () => {
      const tagId = TagId.generate();
      const tag1 = new Tag(tagId, 'javascript');
      const tag2 = new Tag(tagId, 'different-value');

      expect(tag1.equals(tag2)).toBe(true);
    });

    it('should return false for tags with different ids', () => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('javascript');

      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const tag = Tag.create('javascript');

      expect(tag.equals(null as any)).toBe(false);
      expect(tag.equals(undefined as any)).toBe(false);
    });

    it('should return false when comparing with non-Tag objects', () => {
      const tag = Tag.create('javascript');

      expect(tag.equals('javascript' as any)).toBe(false);
      expect(
        tag.equals({ id: tag.id, normalizedValue: tag.normalizedValue } as any)
      ).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of id after creation', () => {
      const tag = Tag.create('javascript');
      const originalId = tag.id;

      expect(() => {
        (tag as any).id = TagId.generate();
      }).toThrow();

      expect(tag.id).toBe(originalId);
    });

    it('should not allow modification of normalizedValue after creation', () => {
      const tag = Tag.create('javascript');
      const originalValue = tag.normalizedValue;

      expect(() => {
        (tag as any).normalizedValue = 'modified';
      }).toThrow();

      expect(tag.normalizedValue).toBe(originalValue);
    });
  });

  describe('toString method', () => {
    it('should return string representation of tag', () => {
      const tag = Tag.create('javascript');
      const result = tag.toString();

      expect(result).toContain('Tag');
      expect(result).toContain(tag.id.toString());
      expect(result).toContain('javascript');
    });
  });

  describe('business invariants', () => {
    it('should maintain unique identity per tag instance', () => {
      const tag1 = Tag.create('javascript');
      const tag2 = Tag.create('javascript');

      // Same normalized value but different identity
      expect(tag1.normalizedValue).toBe(tag2.normalizedValue);
      expect(tag1.equals(tag2)).toBe(false);
    });

    it('should enforce normalized value consistency', () => {
      const tagId = TagId.generate();
      const tag = new Tag(tagId, 'javascript');

      // Normalized value should remain exactly as provided
      expect(tag.normalizedValue).toBe('javascript');
    });

    it('should be comparable by identity', () => {
      const tagId = TagId.generate();
      const tag1 = new Tag(tagId, 'javascript');
      const tag2 = new Tag(tagId, 'python'); // Different value, same id

      expect(tag1.equals(tag2)).toBe(true); // Identity-based equality
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON with id and normalizedValue', () => {
      const tag = Tag.create('javascript');
      const serialized = JSON.stringify({ tag });
      const parsed = JSON.parse(serialized);

      expect(parsed.tag).toHaveProperty('id');
      expect(parsed.tag).toHaveProperty('normalizedValue');
      expect(parsed.tag.normalizedValue).toBe('javascript');
    });
  });
});
