import { normalizeString, slugify, truncate, sanitizeInput, isEmptyOrWhitespace } from '../string-utils';
import { Result } from '../result';

describe('String Utilities', () => {
  describe('normalizeString', () => {
    it('should trim and normalize whitespace', () => {
      expect(normalizeString('  hello   world  ')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(normalizeString('')).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(normalizeString(null as any)).toBe('');
      expect(normalizeString(undefined as any)).toBe('');
    });

    it('should normalize line breaks', () => {
      expect(normalizeString('hello\nworld\r\n')).toBe('hello world');
    });
  });

  describe('slugify', () => {
    it('should create URL-safe slug', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
    });

    it('should handle special characters', () => {
      expect(slugify('Café & Restaurant')).toBe('cafe-restaurant');
    });

    it('should handle empty input', () => {
      expect(slugify('')).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10);
      expect(result.unwrap()).toBe('This is...');
    });

    it('should not truncate short strings', () => {
      const result = truncate('Short', 10);
      expect(result.unwrap()).toBe('Short');
    });

    it('should handle invalid length', () => {
      const result = truncate('test', -1);
      expect(result.isErr()).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeInput('<script>alert("xss")</script>');
      expect(result.unwrap()).not.toContain('<script>');
    });

    it('should preserve safe text', () => {
      const result = sanitizeInput('Hello world!');
      expect(result.unwrap()).toBe('Hello world!');
    });
  });

  describe('isEmptyOrWhitespace', () => {
    it('should detect empty strings', () => {
      expect(isEmptyOrWhitespace('')).toBe(true);
      expect(isEmptyOrWhitespace('   ')).toBe(true);
      expect(isEmptyOrWhitespace('hello')).toBe(false);
    });
  });

  describe('error handling in sanitizeInput', () => {
    it('should handle sanitization error', () => {
      // Mock String.prototype.replace to throw
      const originalReplace = String.prototype.replace;
      String.prototype.replace = jest.fn().mockImplementation(() => {
        throw new Error('Mock replace error');
      });
      
      const result = sanitizeInput('test');
      expect(result.isErr()).toBe(true);
      
      // Restore original method
      String.prototype.replace = originalReplace;
    });
  });
});