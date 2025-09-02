import { ValidationConstants, ValidationRules } from '../validation-constants';

describe('Validation Constants', () => {
  describe('ValidationConstants', () => {
    it('should have correct string limits', () => {
      expect(ValidationConstants.MAX_STRING_LENGTH).toBe(1000);
      expect(ValidationConstants.MAX_TAG_LENGTH).toBe(50);
      expect(ValidationConstants.MIN_SEARCH_LENGTH).toBe(2);
    });

    it('should have correct patterns', () => {
      expect(ValidationConstants.VALID_TAG_PATTERN).toBeInstanceOf(RegExp);
      expect(ValidationConstants.EMAIL_PATTERN).toBeInstanceOf(RegExp);
    });

    it('should validate email pattern', () => {
      expect(ValidationConstants.EMAIL_PATTERN.test('test@example.com')).toBe(true);
      expect(ValidationConstants.EMAIL_PATTERN.test('invalid-email')).toBe(false);
    });

    it('should validate tag pattern', () => {
      expect(ValidationConstants.VALID_TAG_PATTERN.test('valid-tag')).toBe(true);
      expect(ValidationConstants.VALID_TAG_PATTERN.test('invalid tag!')).toBe(false);
    });
  });

  describe('ValidationRules', () => {
    it('should validate string length', () => {
      const result = ValidationRules.validateStringLength('hello', 10);
      expect(result.isOk()).toBe(true);
    });

    it('should reject long strings', () => {
      const result = ValidationRules.validateStringLength('very long string', 5);
      expect(result.isErr()).toBe(true);
    });

    it('should validate tags', () => {
      const result = ValidationRules.validateTag('valid-tag');
      expect(result.isOk()).toBe(true);
    });

    it('should reject invalid tags', () => {
      const result = ValidationRules.validateTag('invalid tag!');
      expect(result.isErr()).toBe(true);
    });

    it('should validate email', () => {
      const result = ValidationRules.validateEmail('test@example.com');
      expect(result.isOk()).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = ValidationRules.validateEmail('invalid');
      expect(result.isErr()).toBe(true);
    });

    it('should validate search term', () => {
      const result = ValidationRules.validateSearchTerm('valid search');
      expect(result.isOk()).toBe(true);
    });

    it('should reject short search term', () => {
      const result = ValidationRules.validateSearchTerm('x');
      expect(result.isErr()).toBe(true);
    });
  });
});