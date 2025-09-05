import { TagFactory } from '../tag-factory';
import { Tag } from '../tag';
import { TagNormalizer } from '../tag-normalizer';
import { TagValidator } from '../tag-validator';
import { TagId } from '@misc-poc/shared';

describe('TagFactory', () => {
  let factory: TagFactory;

  beforeEach(() => {
    factory = new TagFactory();
  });

  describe('constructor', () => {
    it('should create factory with default normalizer and validator', () => {
      expect(factory).toBeInstanceOf(TagFactory);
    });

    it('should create factory with custom normalizer and validator', () => {
      const normalizer = new TagNormalizer();
      const validator = new TagValidator();

      const customFactory = new TagFactory(normalizer, validator);

      expect(customFactory).toBeInstanceOf(TagFactory);
    });
  });

  describe('createFromString method', () => {
    describe('successful creation', () => {
      it('should create tag from valid string with normalization', () => {
        const input = 'JavaScript';

        const tag = factory.createFromString(input);

        expect(tag).toBeInstanceOf(Tag);
        expect(tag.normalizedValue).toBe('javascript'); // normalized to lowercase
        expect(tag.id).toBeInstanceOf(TagId);
      });

      it('should normalize input before creating tag', () => {
        const inputs = [
          { input: 'JavaScript', expected: 'javascript' },
          { input: 'HTML5', expected: 'html5' },
          { input: 'Node.JS', expected: 'node.js' },
          { input: 'C++', expected: 'c++' },
        ];

        inputs.forEach(({ input, expected }) => {
          const tag = factory.createFromString(input);
          expect(tag.normalizedValue).toBe(expected);
        });
      });

      it('should handle Unicode characters with normalization', () => {
        const input = 'Café-Script';

        const tag = factory.createFromString(input);

        expect(tag.normalizedValue).toBe('cafe-script'); // diacritics removed, lowercase
      });

      it('should generate unique IDs for same input', () => {
        const input = 'javascript';

        const tag1 = factory.createFromString(input);
        const tag2 = factory.createFromString(input);

        expect(tag1.normalizedValue).toBe(tag2.normalizedValue);
        expect(tag1.id.equals(tag2.id)).toBe(false); // Different IDs
      });
    });

    describe('validation failures', () => {
      it('should throw error for null input', () => {
        expect(() =>
          factory.createFromString(null as unknown as string)
        ).toThrow('Cannot create tag: Tag cannot be null or undefined');
      });

      it('should throw error for undefined input', () => {
        expect(() =>
          factory.createFromString(undefined as unknown as string)
        ).toThrow('Cannot create tag: Tag cannot be null or undefined');
      });

      it('should throw error for empty string', () => {
        expect(() => factory.createFromString('')).toThrow(
          'Cannot create tag: Tag cannot be empty'
        );
      });

      it('should throw error for whitespace-only string', () => {
        expect(() => factory.createFromString('   ')).toThrow(
          'Cannot create tag: Tag cannot be empty'
        );
      });

      it('should throw error for strings with forbidden characters', () => {
        const forbiddenInputs = [
          'tag{bracket',
          'tag}bracket',
          'tag[square',
          'tag]square',
          'tag:colon',
          'tag,comma',
          'tag"quote',
          'tag\\backslash',
        ];

        forbiddenInputs.forEach((input) => {
          expect(() => factory.createFromString(input)).toThrow(
            /Cannot create tag: Tag contains forbidden character:/
          );
        });
      });

      it('should throw error for strings exceeding length limit', () => {
        const longInput = 'a'.repeat(101);

        expect(() => factory.createFromString(longInput)).toThrow(
          'Cannot create tag: Tag cannot exceed 100 characters'
        );
      });

      it('should throw error for strings containing whitespace after normalization', () => {
        // Even if input looks valid, if it contains whitespace after normalization it should fail
        const input = 'tag with spaces';

        expect(() => factory.createFromString(input)).toThrow(
          'Cannot create tag: Tag cannot contain whitespace characters'
        );
      });
    });

    describe('normalization edge cases', () => {
      it('should handle strings that become empty after normalization', () => {
        // This would be an edge case where normalization removes all content
        const input = '   '; // Only whitespace

        expect(() => factory.createFromString(input)).toThrow(
          'Cannot create tag: Tag cannot be empty'
        );
      });

      it('should preserve valid special characters', () => {
        const validInputs = [
          { input: 'Node.js', expected: 'node.js' },
          { input: 'C++', expected: 'c++' },
          { input: 'ASP.NET', expected: 'asp.net' },
          { input: 'test_case', expected: 'test_case' },
          { input: 'kebab-case', expected: 'kebab-case' },
        ];

        validInputs.forEach(({ input, expected }) => {
          const tag = factory.createFromString(input);
          expect(tag.normalizedValue).toBe(expected);
        });
      });
    });

    describe('custom configuration', () => {
      it('should use custom normalizer configuration', () => {
        const customNormalizer = new TagNormalizer({ lowercase: false });
        const customFactory = new TagFactory(customNormalizer);

        const tag = customFactory.createFromString('JavaScript');

        expect(tag.normalizedValue).toBe('JavaScript'); // Not normalized to lowercase
      });

      it('should work with different normalizer settings', () => {
        const normalizer = new TagNormalizer({
          lowercase: true,
          removeDiacritics: false,
        });
        const customFactory = new TagFactory(normalizer);

        const tag = customFactory.createFromString('Café');

        expect(tag.normalizedValue).toBe('café'); // Lowercase but diacritics preserved
      });
    });
  });

  describe('error handling', () => {
    it('should aggregate multiple validation errors in error message', () => {
      const input =
        'very-long-tag-name-that-exceeds-the-maximum-allowed-length-for-tags-and-also-contains{forbidden}chars';

      expect(() => factory.createFromString(input)).toThrow(
        /Cannot create tag:/
      );
    });

    it('should handle normalization errors gracefully', () => {
      // Create a mock normalizer that throws
      const throwingNormalizer = {
        normalize: jest.fn().mockImplementation(() => {
          throw new Error('Normalization failed');
        }),
      };

      const factoryWithThrowingNormalizer = new TagFactory(
        throwingNormalizer as unknown as TagNormalizer
      );

      expect(() =>
        factoryWithThrowingNormalizer.createFromString('test')
      ).toThrow('Normalization failed');
    });
  });

  describe('integration with Tag entity', () => {
    it('should create Tag that passes all Tag entity invariants', () => {
      const tag = factory.createFromString('JavaScript');

      // Test that the created tag behaves correctly
      expect(tag.id).toBeInstanceOf(TagId);
      expect(tag.normalizedValue).toBe('javascript');
      expect(typeof tag.toString()).toBe('string');
      expect(tag.equals(tag)).toBe(true);
    });

    it('should create Tags that can be compared correctly', () => {
      const tag1 = factory.createFromString('javascript');
      const tag2 = factory.createFromString('javascript');
      const tag3 = factory.createFromString('python');

      // Same normalized value but different identity
      expect(tag1.normalizedValue).toBe(tag2.normalizedValue);
      expect(tag1.equals(tag2)).toBe(false); // Different IDs

      // Different normalized values
      expect(tag1.normalizedValue).not.toBe(tag3.normalizedValue);
      expect(tag1.equals(tag3)).toBe(false);
    });
  });

  describe('performance considerations', () => {
    it('should handle reasonable batch creation without issues', () => {
      const inputs = Array.from({ length: 100 }, (_, i) => `tag${i}`);

      expect(() => {
        inputs.forEach((input) => factory.createFromString(input));
      }).not.toThrow();
    });
  });
});
