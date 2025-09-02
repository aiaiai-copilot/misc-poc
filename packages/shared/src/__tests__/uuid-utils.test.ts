import { generateUuid, validateUuid, isValidUuid, parseUuid } from '../uuid-utils';
import { Result } from '../result';

describe('UUID Utilities', () => {
  describe('generateUuid', () => {
    it('should generate a valid UUID v4', () => {
      const uuid = generateUuid();
      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUuid();
      const uuid2 = generateUuid();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should generate UUID with correct version (4)', () => {
      const uuid = generateUuid();
      const versionChar = uuid.charAt(14);
      expect(versionChar).toBe('4');
    });

    it('should generate UUID with correct variant bits', () => {
      const uuid = generateUuid();
      const variantChar = uuid.charAt(19);
      expect(['8', '9', 'a', 'b']).toContain(variantChar.toLowerCase());
    });
  });

  describe('validateUuid', () => {
    it('should return Ok for valid UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateUuid(validUuid);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(validUuid);
    });

    it('should return Err for invalid UUID format', () => {
      const invalidUuid = 'invalid-uuid';
      const result = validateUuid(invalidUuid);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid UUID format');
    });

    it('should return Err for UUID with wrong length', () => {
      const shortUuid = '550e8400-e29b-41d4-a716';
      const result = validateUuid(shortUuid);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid UUID format');
    });

    it('should return Err for UUID with invalid characters', () => {
      const invalidUuid = '550e8400-e29b-41d4-a716-44665544000g';
      const result = validateUuid(invalidUuid);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid UUID format');
    });

    it('should return Err for empty string', () => {
      const result = validateUuid('');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid UUID format');
    });

    it('should return Err for null input', () => {
      const result = validateUuid(null as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('UUID must be a string');
    });

    it('should return Err for undefined input', () => {
      const result = validateUuid(undefined as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('UUID must be a string');
    });
  });

  describe('isValidUuid', () => {
    it('should return true for valid UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUuid(validUuid)).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      expect(isValidUuid('invalid-uuid')).toBe(false);
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid(null as any)).toBe(false);
      expect(isValidUuid(undefined as any)).toBe(false);
    });

    it('should return true for generated UUIDs', () => {
      const uuid = generateUuid();
      expect(isValidUuid(uuid)).toBe(true);
    });
  });

  describe('parseUuid', () => {
    it('should return Ok with normalized UUID for valid input', () => {
      const validUuid = '550E8400-E29B-41D4-A716-446655440000';
      const result = parseUuid(validUuid);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return Ok for already lowercase UUID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = parseUuid(validUuid);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(validUuid);
    });

    it('should return Ok for UUID without dashes and add them', () => {
      const uuidWithoutDashes = '550e8400e29b41d4a716446655440000';
      const result = parseUuid(uuidWithoutDashes);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return Err for invalid UUID', () => {
      const invalidUuid = 'invalid-uuid';
      const result = parseUuid(invalidUuid);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid UUID');
    });

    it('should trim whitespace before parsing', () => {
      const uuidWithSpaces = '  550e8400-e29b-41d4-a716-446655440000  ';
      const result = parseUuid(uuidWithSpaces);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return Err for null input', () => {
      const result = parseUuid(null as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('UUID input must be a string');
    });

    it('should return Err for undefined input', () => {
      const result = parseUuid(undefined as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('UUID input must be a string');
    });
  });

  describe('integration with Result type', () => {
    it('should work seamlessly with Result chaining', () => {
      const validUuid = '550E8400-E29B-41D4-A716-446655440000';
      const result = parseUuid(validUuid)
        .andThen(uuid => validateUuid(uuid))
        .map(uuid => uuid.toUpperCase());
      
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('550E8400-E29B-41D4-A716-446655440000');
    });

    it('should propagate errors in Result chain', () => {
      const invalidUuid = 'invalid';
      const result = parseUuid(invalidUuid)
        .andThen(uuid => validateUuid(uuid))
        .map(uuid => uuid.toUpperCase());
      
      expect(result.isErr()).toBe(true);
    });
  });
});