import { TagValidator } from '../tag-validator';

describe('TagValidator', () => {
  let validator: TagValidator;

  beforeEach(() => {
    validator = new TagValidator();
  });

  describe('constructor', () => {
    it('should create TagValidator instance', () => {
      expect(validator).toBeInstanceOf(TagValidator);
    });
  });

  describe('validate method', () => {
    describe('successful validation', () => {
      it('should return valid result for correct tags', () => {
        const validTags = [
          'javascript',
          'HTML5',
          'node-js',
          'React',
          'typescript',
          'vue.js',
          'angular',
          'python3',
          'machine-learning',
          'data-science',
          'api-design',
          'test-driven-development',
          'microservices-architecture',
          'devops-tools',
          'frontend-frameworks',
        ];

        validTags.forEach((tag) => {
          const result = validator.validate(tag);
          expect(result.isValid).toBe(true);
          expect(result.errors).toEqual([]);
          expect(result.tag).toBe(tag);
        });
      });

      it('should handle Unicode characters correctly', () => {
        const unicodeTags = [
          'café',
          'naïve',
          'résumé',
          'español',
          'français',
          'Москва',
          'العربية',
          '中文',
          '日本語',
          'हिन्दी',
        ];

        unicodeTags.forEach((tag) => {
          const result = validator.validate(tag);
          expect(result.isValid).toBe(true);
          expect(result.errors).toEqual([]);
          expect(result.tag).toBe(tag);
        });
      });

      it('should accept tags at boundary lengths', () => {
        const oneChar = 'a';
        const hundredChars = 'a'.repeat(100);

        expect(validator.validate(oneChar).isValid).toBe(true);
        expect(validator.validate(hundredChars).isValid).toBe(true);
      });
    });

    describe('length validation', () => {
      it('should reject empty string', () => {
        const result = validator.validate('');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tag cannot be empty');
        expect(result.tag).toBe('');
      });

      it('should reject tags longer than 100 characters', () => {
        const longTag = 'a'.repeat(101);
        const result = validator.validate(longTag);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tag cannot exceed 100 characters');
        expect(result.tag).toBe(longTag);
      });

      it('should provide correct error message for very long tags', () => {
        const veryLongTag =
          'javascript-framework-for-building-user-interfaces-with-component-based-architecture-and-virtual-dom-rendering-system-that-enables-efficient-updates-and-state-management';
        const result = validator.validate(veryLongTag);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tag cannot exceed 100 characters');
      });
    });

    describe('forbidden characters validation', () => {
      const forbiddenChars = ['{', '}', '[', ']', ':', ',', '"', '\\'];

      forbiddenChars.forEach((char) => {
        it(`should reject tags containing forbidden character "${char}"`, () => {
          const tagWithForbidden = `javascript${char}framework`;
          const result = validator.validate(tagWithForbidden);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(
            `Tag contains forbidden character: ${char}`
          );
          expect(result.tag).toBe(tagWithForbidden);
        });
      });

      it('should detect multiple forbidden characters', () => {
        const tagWithMultiple = 'tag{with}multiple[forbidden]:characters';
        const result = validator.validate(tagWithMultiple);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors).toContain('Tag contains forbidden character: {');
        expect(result.errors).toContain('Tag contains forbidden character: }');
        expect(result.errors).toContain('Tag contains forbidden character: [');
        expect(result.errors).toContain('Tag contains forbidden character: ]');
        expect(result.errors).toContain('Tag contains forbidden character: :');
      });

      it('should allow similar but valid characters', () => {
        const validChars = ['(', ')', '-', '_', '.', '+', '#', '@'];
        validChars.forEach((char) => {
          const tagWithChar = `javascript${char}framework`;
          const result = validator.validate(tagWithChar);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('whitespace validation', () => {
      it('should reject tags with spaces', () => {
        const tagsWithSpaces = [
          'java script',
          'node js',
          'machine learning',
          'data science',
          ' javascript',
          'javascript ',
          ' javascript ',
          'java  script', // multiple spaces
        ];

        tagsWithSpaces.forEach((tag) => {
          const result = validator.validate(tag);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(
            'Tag cannot contain whitespace characters'
          );
          expect(result.tag).toBe(tag);
        });
      });

      it('should reject tags with various whitespace characters', () => {
        const whitespaceChars = [
          ' ',
          '\t',
          '\n',
          '\r',
          '\u00A0',
          '\u2000',
          '\u2001',
          '\u2002',
          '\u2003',
        ];

        whitespaceChars.forEach((char) => {
          const tagWithWhitespace = `javascript${char}framework`;
          const result = validator.validate(tagWithWhitespace);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(
            'Tag cannot contain whitespace characters'
          );
        });
      });
    });

    describe('null and undefined handling', () => {
      it('should reject null input', () => {
        const result = validator.validate(null);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tag cannot be null or undefined');
        expect(result.tag).toBe(null);
      });

      it('should reject undefined input', () => {
        const result = validator.validate(undefined);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Tag cannot be null or undefined');
        expect(result.tag).toBe(undefined);
      });
    });

    describe('multiple validation errors', () => {
      it('should return all applicable errors for invalid tag', () => {
        const invalidTag =
          '{this-is-a-very-long-tag-that-exceeds-the-maximum-allowed-length-of-one-hundred-characters-and-also contains spaces and forbidden characters: like this}';
        const result = validator.validate(invalidTag);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors).toContain('Tag cannot exceed 100 characters');
        expect(result.errors).toContain(
          'Tag cannot contain whitespace characters'
        );
        expect(result.errors).toContain('Tag contains forbidden character: {');
        expect(result.errors).toContain('Tag contains forbidden character: }');
        expect(result.errors).toContain('Tag contains forbidden character: :');
      });

      it('should handle empty string with specific error', () => {
        const result = validator.validate('');
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(['Tag cannot be empty']);
      });
    });

    describe('edge cases', () => {
      it('should handle tags with only allowed special characters', () => {
        const specialTags = [
          'c++',
          '.net',
          'jquery',
          'node.js',
          'vue.js',
          'asp.net',
          'c#',
          'f#',
          '@angular',
          'react-native',
          'test_case',
          'snake_case',
          'kebab-case',
          'PascalCase',
          'camelCase',
        ];

        specialTags.forEach((tag) => {
          const result = validator.validate(tag);
          expect(result.isValid).toBe(true);
          expect(result.errors).toEqual([]);
        });
      });

      it('should handle numeric tags', () => {
        const numericTags = ['123', '42', '2024', '1.0', '3.14'];

        numericTags.forEach((tag) => {
          const result = validator.validate(tag);
          expect(result.isValid).toBe(true);
          expect(result.errors).toEqual([]);
        });
      });
    });
  });

  describe('validation result structure', () => {
    it('should return correct structure for valid tag', () => {
      const tag = 'javascript';
      const result = validator.validate(tag);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('tag');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return correct structure for invalid tag', () => {
      const tag = 'invalid tag with spaces';
      const result = validator.validate(tag);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('tag');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
