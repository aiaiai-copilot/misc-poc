import { TagId } from '../tag-id';
import { generateUuid, isValidUuid } from '../uuid-utils';

describe('TagId', () => {
  describe('constructor', () => {
    it('should create TagId from valid UUID string', () => {
      const validUuid = generateUuid();
      const tagId = new TagId(validUuid);
      
      expect(tagId.toString()).toBe(validUuid);
      expect(tagId.value).toBe(validUuid);
    });

    it('should create TagId from valid UUID string with different casing', () => {
      const validUuid = generateUuid();
      const upperCaseUuid = validUuid.toUpperCase();
      const tagId = new TagId(upperCaseUuid);
      
      expect(tagId.toString()).toBe(validUuid.toLowerCase());
      expect(tagId.value).toBe(validUuid.toLowerCase());
    });

    it('should throw error for invalid UUID format', () => {
      const invalidUuids = [
        'invalid-uuid',
        '123',
        '',
        'not-a-uuid-at-all',
        '12345678-1234-1234-1234-12345678901g', // invalid character
        '12345678-1234-1234-1234-1234567890123', // too long (13 chars in last segment)
        '12345678-1234-1234-1234', // too short (missing last segment)
        '12345678-1234-1234-1234-12345678901', // too short (11 chars in last segment)
      ];

      invalidUuids.forEach(invalidUuid => {
        expect(() => new TagId(invalidUuid)).toThrow(`Invalid TagId: Invalid UUID format: ${invalidUuid}`);
      });
    });

    it('should throw error for null or undefined input', () => {
      expect(() => new TagId(null as any)).toThrow();
      expect(() => new TagId(undefined as any)).toThrow();
    });
  });

  describe('generate', () => {
    it('should generate new TagId with valid UUID', () => {
      const tagId = TagId.generate();
      
      expect(tagId).toBeInstanceOf(TagId);
      expect(isValidUuid(tagId.value)).toBe(true);
    });

    it('should generate unique TagIds', () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      
      expect(tagId1.value).not.toBe(tagId2.value);
    });
  });

  describe('equals', () => {
    it('should return true for TagIds with same UUID', () => {
      const uuid = generateUuid();
      const tagId1 = new TagId(uuid);
      const tagId2 = new TagId(uuid);
      
      expect(tagId1.equals(tagId2)).toBe(true);
    });

    it('should return true for TagIds with same UUID but different casing', () => {
      const uuid = generateUuid();
      const tagId1 = new TagId(uuid.toLowerCase());
      const tagId2 = new TagId(uuid.toUpperCase());
      
      expect(tagId1.equals(tagId2)).toBe(true);
    });

    it('should return false for TagIds with different UUIDs', () => {
      const tagId1 = TagId.generate();
      const tagId2 = TagId.generate();
      
      expect(tagId1.equals(tagId2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const tagId = TagId.generate();
      
      expect(tagId.equals(null as any)).toBe(false);
      expect(tagId.equals(undefined as any)).toBe(false);
    });

    it('should return false when comparing with non-TagId objects', () => {
      const tagId = TagId.generate();
      
      expect(tagId.equals('string' as any)).toBe(false);
      expect(tagId.equals({ value: tagId.value } as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the UUID string', () => {
      const uuid = generateUuid();
      const tagId = new TagId(uuid);
      
      expect(tagId.toString()).toBe(uuid);
    });

    it('should return lowercase UUID string', () => {
      const uuid = generateUuid().toUpperCase();
      const tagId = new TagId(uuid);
      
      expect(tagId.toString()).toBe(uuid.toLowerCase());
    });
  });

  describe('value getter', () => {
    it('should return the UUID string', () => {
      const uuid = generateUuid();
      const tagId = new TagId(uuid);
      
      expect(tagId.value).toBe(uuid);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal state', () => {
      const tagId = TagId.generate();
      const originalValue = tagId.value;
      
      // Try to modify the value (this should not be possible)
      expect(() => {
        (tagId as any).value = 'modified';
      }).toThrow();
      
      expect(tagId.value).toBe(originalValue);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON as string', () => {
      const tagId = TagId.generate();
      const serialized = JSON.stringify({ id: tagId });
      const parsed = JSON.parse(serialized);
      
      expect(parsed.id).toBe(tagId.value);
    });
  });
});