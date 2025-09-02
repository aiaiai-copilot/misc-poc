import { RecordId } from '../record-id';
import { generateUuid, isValidUuid } from '../uuid-utils';

describe('RecordId', () => {
  describe('constructor', () => {
    it('should create RecordId from valid UUID string', () => {
      const validUuid = generateUuid();
      const recordId = new RecordId(validUuid);
      
      expect(recordId.toString()).toBe(validUuid);
      expect(recordId.value).toBe(validUuid);
    });

    it('should create RecordId from valid UUID string with different casing', () => {
      const validUuid = generateUuid();
      const upperCaseUuid = validUuid.toUpperCase();
      const recordId = new RecordId(upperCaseUuid);
      
      expect(recordId.toString()).toBe(validUuid.toLowerCase());
      expect(recordId.value).toBe(validUuid.toLowerCase());
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
        expect(() => new RecordId(invalidUuid)).toThrow(`Invalid RecordId: Invalid UUID format: ${invalidUuid}`);
      });
    });

    it('should throw error for null or undefined input', () => {
      expect(() => new RecordId(null as any)).toThrow();
      expect(() => new RecordId(undefined as any)).toThrow();
    });
  });

  describe('generate', () => {
    it('should generate new RecordId with valid UUID', () => {
      const recordId = RecordId.generate();
      
      expect(recordId).toBeInstanceOf(RecordId);
      expect(isValidUuid(recordId.value)).toBe(true);
    });

    it('should generate unique RecordIds', () => {
      const recordId1 = RecordId.generate();
      const recordId2 = RecordId.generate();
      
      expect(recordId1.value).not.toBe(recordId2.value);
    });
  });

  describe('equals', () => {
    it('should return true for RecordIds with same UUID', () => {
      const uuid = generateUuid();
      const recordId1 = new RecordId(uuid);
      const recordId2 = new RecordId(uuid);
      
      expect(recordId1.equals(recordId2)).toBe(true);
    });

    it('should return true for RecordIds with same UUID but different casing', () => {
      const uuid = generateUuid();
      const recordId1 = new RecordId(uuid.toLowerCase());
      const recordId2 = new RecordId(uuid.toUpperCase());
      
      expect(recordId1.equals(recordId2)).toBe(true);
    });

    it('should return false for RecordIds with different UUIDs', () => {
      const recordId1 = RecordId.generate();
      const recordId2 = RecordId.generate();
      
      expect(recordId1.equals(recordId2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const recordId = RecordId.generate();
      
      expect(recordId.equals(null as any)).toBe(false);
      expect(recordId.equals(undefined as any)).toBe(false);
    });

    it('should return false when comparing with non-RecordId objects', () => {
      const recordId = RecordId.generate();
      
      expect(recordId.equals('string' as any)).toBe(false);
      expect(recordId.equals({ value: recordId.value } as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the UUID string', () => {
      const uuid = generateUuid();
      const recordId = new RecordId(uuid);
      
      expect(recordId.toString()).toBe(uuid);
    });

    it('should return lowercase UUID string', () => {
      const uuid = generateUuid().toUpperCase();
      const recordId = new RecordId(uuid);
      
      expect(recordId.toString()).toBe(uuid.toLowerCase());
    });
  });

  describe('value getter', () => {
    it('should return the UUID string', () => {
      const uuid = generateUuid();
      const recordId = new RecordId(uuid);
      
      expect(recordId.value).toBe(uuid);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal state', () => {
      const recordId = RecordId.generate();
      const originalValue = recordId.value;
      
      // Try to modify the value (this should not be possible)
      expect(() => {
        (recordId as any).value = 'modified';
      }).toThrow();
      
      expect(recordId.value).toBe(originalValue);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON as string', () => {
      const recordId = RecordId.generate();
      const serialized = JSON.stringify({ id: recordId });
      const parsed = JSON.parse(serialized);
      
      expect(parsed.id).toBe(recordId.value);
    });
  });
});