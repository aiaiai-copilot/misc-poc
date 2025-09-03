import { TagNormalizer, TagNormalizerConfig } from '../tag-normalizer';

describe('TagNormalizer', () => {
  describe('constructor and configuration', () => {
    it('should create TagNormalizer with default configuration', () => {
      const normalizer = new TagNormalizer();

      expect(normalizer).toBeInstanceOf(TagNormalizer);
    });

    it('should create TagNormalizer with custom configuration', () => {
      const config: TagNormalizerConfig = {
        lowercase: false,
        removeDiacritics: false,
        unicodeNormalization: 'NFKC',
      };

      const normalizer = new TagNormalizer(config);

      expect(normalizer).toBeInstanceOf(TagNormalizer);
    });

    it('should throw error for invalid Unicode normalization form', () => {
      const config: TagNormalizerConfig = {
        lowercase: true,
        removeDiacritics: true,
        unicodeNormalization: 'INVALID' as 'NFC', // Invalid value to test error handling
      };

      expect(() => new TagNormalizer(config)).toThrow(
        'Invalid Unicode normalization form'
      );
    });
  });

  describe('normalize method', () => {
    describe('with default configuration', () => {
      let normalizer: TagNormalizer;

      beforeEach(() => {
        normalizer = new TagNormalizer();
      });

      it('should convert to lowercase by default', () => {
        expect(normalizer.normalize('JavaScript')).toBe('javascript');
        expect(normalizer.normalize('HTML')).toBe('html');
        expect(normalizer.normalize('CSS')).toBe('css');
      });

      it('should remove diacritics by default', () => {
        expect(normalizer.normalize('café')).toBe('cafe');
        expect(normalizer.normalize('naïve')).toBe('naive');
        expect(normalizer.normalize('résumé')).toBe('resume');
        expect(normalizer.normalize('piñata')).toBe('pinata');
        expect(normalizer.normalize('Zürich')).toBe('zurich');
      });

      it('should normalize Unicode to NFC by default', () => {
        // Using decomposed characters (NFD) that should be normalized to composed (NFC)
        const decomposed = 'é'; // This is actually 'e' + combining acute accent
        const composed = 'é'; // This is the single composed character

        expect(normalizer.normalize(decomposed)).toBe('e');
        expect(normalizer.normalize(composed)).toBe('e');
      });

      it('should handle empty strings', () => {
        expect(normalizer.normalize('')).toBe('');
      });

      it('should handle whitespace', () => {
        expect(normalizer.normalize('  tag with spaces  ')).toBe(
          '  tag with spaces  '
        );
        expect(normalizer.normalize('\t\n')).toBe('\t\n');
      });

      it('should handle special characters', () => {
        expect(normalizer.normalize('tag-with-hyphens')).toBe(
          'tag-with-hyphens'
        );
        expect(normalizer.normalize('tag_with_underscores')).toBe(
          'tag_with_underscores'
        );
        expect(normalizer.normalize('tag.with.dots')).toBe('tag.with.dots');
        expect(normalizer.normalize('tag@symbol')).toBe('tag@symbol');
      });

      it('should handle numbers', () => {
        expect(normalizer.normalize('version2.0')).toBe('version2.0');
        expect(normalizer.normalize('2023')).toBe('2023');
      });
    });

    describe('with lowercase disabled', () => {
      let normalizer: TagNormalizer;

      beforeEach(() => {
        normalizer = new TagNormalizer({ lowercase: false });
      });

      it('should preserve original casing when lowercase is disabled', () => {
        expect(normalizer.normalize('JavaScript')).toBe('JavaScript');
        expect(normalizer.normalize('HTML')).toBe('HTML');
        expect(normalizer.normalize('CamelCase')).toBe('CamelCase');
      });

      it('should still remove diacritics and normalize Unicode when lowercase is disabled', () => {
        expect(normalizer.normalize('Café')).toBe('Cafe');
        expect(normalizer.normalize('RÉSUMÉ')).toBe('RESUME');
      });
    });

    describe('with diacritics removal disabled', () => {
      let normalizer: TagNormalizer;

      beforeEach(() => {
        normalizer = new TagNormalizer({ removeDiacritics: false });
      });

      it('should preserve diacritics when removal is disabled', () => {
        expect(normalizer.normalize('café')).toBe('café');
        expect(normalizer.normalize('naïve')).toBe('naïve');
        expect(normalizer.normalize('résumé')).toBe('résumé');
      });

      it('should still convert to lowercase and normalize Unicode when diacritics removal is disabled', () => {
        expect(normalizer.normalize('CAFÉ')).toBe('café');
      });
    });

    describe('with different Unicode normalization forms', () => {
      it('should use NFC normalization', () => {
        const normalizer = new TagNormalizer({
          unicodeNormalization: 'NFC',
          removeDiacritics: false,
        });

        // Test with decomposed characters that should be normalized to composed form
        expect(normalizer.normalize('café')).toBe('café'); // Should normalize to composed form
      });

      it('should use NFD normalization', () => {
        const normalizer = new TagNormalizer({
          unicodeNormalization: 'NFD',
          removeDiacritics: false,
        });

        // Test with composed characters that should be normalized to decomposed form
        // The é character should be decomposed into 'e' + combining acute accent
        const result = normalizer.normalize('café');

        // Check that the result is different from NFC normalization
        const nfcNormalizer = new TagNormalizer({
          unicodeNormalization: 'NFC',
          removeDiacritics: false,
        });
        const nfcResult = nfcNormalizer.normalize('café');

        // Both should render as 'café' but have different internal representations
        expect(result.length).toBeGreaterThanOrEqual(nfcResult.length); // NFD might be longer due to decomposition
        expect(result.normalize('NFC')).toBe(nfcResult); // They should normalize to the same NFC form
      });

      it('should use NFKC normalization', () => {
        const normalizer = new TagNormalizer({
          unicodeNormalization: 'NFKC',
          removeDiacritics: false,
        });

        // Test compatibility characters that should be normalized
        expect(normalizer.normalize('ﬁ')).toBe('fi'); // ligature fi should become f + i
      });

      it('should use NFKD normalization', () => {
        const normalizer = new TagNormalizer({
          unicodeNormalization: 'NFKD',
          removeDiacritics: false,
        });

        // Test compatibility characters that should be normalized and decomposed
        expect(normalizer.normalize('ﬁ')).toBe('fi'); // ligature fi should become f + i
      });
    });

    describe('with all features disabled', () => {
      let normalizer: TagNormalizer;

      beforeEach(() => {
        normalizer = new TagNormalizer({
          lowercase: false,
          removeDiacritics: false,
          unicodeNormalization: false,
        });
      });

      it('should return input unchanged when all features are disabled', () => {
        expect(normalizer.normalize('JavaScript')).toBe('JavaScript');
        expect(normalizer.normalize('Café')).toBe('Café');
        expect(normalizer.normalize('RÉSUMÉ')).toBe('RÉSUMÉ');
      });
    });
  });

  describe('normalization consistency', () => {
    let normalizer: TagNormalizer;

    beforeEach(() => {
      normalizer = new TagNormalizer();
    });

    it('should produce consistent results for the same input', () => {
      const input = 'JavaScript-Café';
      const result1 = normalizer.normalize(input);
      const result2 = normalizer.normalize(input);

      expect(result1).toBe(result2);
      expect(result1).toBe('javascript-cafe');
    });

    it('should produce consistent results for different representations of the same text', () => {
      // Different Unicode representations of the same visual text
      const composed = 'café'; // Single composed character é
      const decomposed = 'cafe\u0301'; // e + combining acute accent

      const result1 = normalizer.normalize(composed);
      const result2 = normalizer.normalize(decomposed);

      expect(result1).toBe(result2);
      expect(result1).toBe('cafe');
    });
  });

  describe('edge cases and error handling', () => {
    let normalizer: TagNormalizer;

    beforeEach(() => {
      normalizer = new TagNormalizer();
    });

    it('should throw error for null input', () => {
      expect(() => normalizer.normalize(null as unknown as string)).toThrow(
        'Input cannot be null or undefined'
      );
    });

    it('should throw error for undefined input', () => {
      expect(() =>
        normalizer.normalize(undefined as unknown as string)
      ).toThrow('Input cannot be null or undefined');
    });

    it('should handle very long strings', () => {
      const longString = 'tag'.repeat(1000);
      const result = normalizer.normalize(longString);

      expect(result).toBe(longString); // Should be unchanged since it's already lowercase
      expect(result.length).toBe(3000);
    });

    it('should handle strings with only Unicode control characters', () => {
      const controlChars = '\u200B\u200C\u200D'; // Zero-width characters
      const result = normalizer.normalize(controlChars);

      expect(typeof result).toBe('string');
    });

    it('should handle mixed scripts', () => {
      const mixedScript = 'hello-мир-世界';
      const result = normalizer.normalize(mixedScript);

      expect(result).toBe('hello-мир-世界'); // Should preserve non-Latin scripts
    });
  });

  describe('performance considerations', () => {
    let normalizer: TagNormalizer;

    beforeEach(() => {
      normalizer = new TagNormalizer();
    });

    it('should handle multiple normalizations efficiently', () => {
      const inputs = [
        'JavaScript',
        'TypeScript',
        'React',
        'Vue.js',
        'Angular',
        'Node.js',
        'Express',
        'MongoDB',
        'PostgreSQL',
        'Redis',
      ];

      const startTime = performance.now();

      inputs.forEach((input) => {
        normalizer.normalize(input);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 10ms for 10 normalizations)
      expect(duration).toBeLessThan(10);
    });
  });
});
