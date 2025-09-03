import { TagParser } from '../tag-parser';
import { TagValidator } from '../tag-validator';
import { TagNormalizer } from '../tag-normalizer';

describe('TagParser', () => {
  let parser: TagParser;
  let mockValidator: jest.Mocked<TagValidator>;
  let mockNormalizer: jest.Mocked<TagNormalizer>;

  beforeEach(() => {
    mockValidator = {
      validate: jest.fn(),
    } as jest.Mocked<TagValidator>;

    mockNormalizer = {
      normalize: jest.fn(),
    } as jest.Mocked<TagNormalizer>;

    parser = new TagParser(mockValidator, mockNormalizer);
  });

  describe('constructor', () => {
    it('should create TagParser instance', () => {
      expect(parser).toBeInstanceOf(TagParser);
    });

    it('should use default TagValidator and TagNormalizer if not provided', () => {
      const defaultParser = new TagParser();
      expect(defaultParser).toBeInstanceOf(TagParser);
    });
  });

  describe('parse method', () => {
    describe('successful parsing', () => {
      it('should parse single valid tag from content string', () => {
        const content = 'javascript';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'javascript',
        });
        mockNormalizer.normalize.mockReturnValue('javascript');

        const result = parser.parse(content);

        expect(mockValidator.validate).toHaveBeenCalledWith('javascript');
        expect(mockNormalizer.normalize).toHaveBeenCalledWith('javascript');
        expect(result).toEqual(['javascript']);
      });

      it('should parse multiple valid tags separated by whitespace', () => {
        const content = 'javascript react nodejs';
        mockValidator.validate
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'javascript' })
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'react' })
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'nodejs' });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react')
          .mockReturnValueOnce('nodejs');

        const result = parser.parse(content);

        expect(mockValidator.validate).toHaveBeenCalledTimes(3);
        expect(mockNormalizer.normalize).toHaveBeenCalledTimes(3);
        expect(result).toEqual(['javascript', 'react', 'nodejs']);
      });

      it('should handle various whitespace characters (spaces, tabs, newlines)', () => {
        const content = 'javascript\treact\nnodejs   vue';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'mock',
        });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react')
          .mockReturnValueOnce('nodejs')
          .mockReturnValueOnce('vue');

        const result = parser.parse(content);

        expect(mockValidator.validate).toHaveBeenCalledTimes(4);
        expect(result).toEqual(['javascript', 'react', 'nodejs', 'vue']);
      });
    });

    describe('filtering invalid tags', () => {
      it('should filter out invalid tags based on TagValidator result', () => {
        const content = 'valid-tag invalid{}tag another-valid';
        mockValidator.validate
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'valid-tag' })
          .mockReturnValueOnce({
            isValid: false,
            errors: ['Contains forbidden character'],
            tag: 'invalid{}tag',
          })
          .mockReturnValueOnce({
            isValid: true,
            errors: [],
            tag: 'another-valid',
          });
        mockNormalizer.normalize
          .mockReturnValueOnce('valid-tag')
          .mockReturnValueOnce('another-valid');

        const result = parser.parse(content);

        expect(result).toEqual(['valid-tag', 'another-valid']);
      });

      it('should handle mix of valid and invalid tags', () => {
        const content = 'javascript invalid: react nodejs{} vue';
        mockValidator.validate
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'javascript' })
          .mockReturnValueOnce({
            isValid: false,
            errors: ['Contains forbidden character'],
            tag: 'invalid:',
          })
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'react' })
          .mockReturnValueOnce({
            isValid: false,
            errors: ['Contains forbidden character'],
            tag: 'nodejs{}',
          })
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'vue' });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react')
          .mockReturnValueOnce('vue');

        const result = parser.parse(content);

        expect(result).toEqual(['javascript', 'react', 'vue']);
      });
    });

    describe('duplicate removal', () => {
      it('should remove duplicate normalized tags', () => {
        const content = 'JavaScript JAVASCRIPT javascript React';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'mock',
        });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react');

        const result = parser.parse(content);

        expect(result).toEqual(['javascript', 'react']);
      });

      it('should preserve order of first occurrence when removing duplicates', () => {
        const content = 'vue react javascript vue nodejs react';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'mock',
        });
        mockNormalizer.normalize
          .mockReturnValueOnce('vue')
          .mockReturnValueOnce('react')
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('vue')
          .mockReturnValueOnce('nodejs')
          .mockReturnValueOnce('react');

        const result = parser.parse(content);

        expect(result).toEqual(['vue', 'react', 'javascript', 'nodejs']);
      });
    });

    describe('edge cases', () => {
      it('should return empty array for empty content string', () => {
        const result = parser.parse('');
        expect(result).toEqual([]);
        expect(mockValidator.validate).not.toHaveBeenCalled();
        expect(mockNormalizer.normalize).not.toHaveBeenCalled();
      });

      it('should return empty array for whitespace-only content', () => {
        const content = '   \t\n   ';
        const result = parser.parse(content);
        expect(result).toEqual([]);
        expect(mockValidator.validate).not.toHaveBeenCalled();
        expect(mockNormalizer.normalize).not.toHaveBeenCalled();
      });

      it('should handle content with only empty tokens after splitting', () => {
        const content = '     ';
        const result = parser.parse(content);
        expect(result).toEqual([]);
      });

      it('should filter out empty tokens from splitting', () => {
        const content = 'javascript    react   ';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'mock',
        });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react');

        const result = parser.parse(content);

        expect(mockValidator.validate).toHaveBeenCalledTimes(2);
        expect(result).toEqual(['javascript', 'react']);
      });

      it('should return empty array when all tags are invalid', () => {
        const content = 'invalid: another{} third[]';
        mockValidator.validate.mockReturnValue({
          isValid: false,
          errors: ['Invalid'],
          tag: null,
        });

        const result = parser.parse(content);

        expect(result).toEqual([]);
        expect(mockNormalizer.normalize).not.toHaveBeenCalled();
      });
    });

    describe('normalization integration', () => {
      it('should normalize valid tags using TagNormalizer', () => {
        const content = 'JavaScript REACT Vue.js';
        mockValidator.validate.mockReturnValue({
          isValid: true,
          errors: [],
          tag: 'mock',
        });
        mockNormalizer.normalize
          .mockReturnValueOnce('javascript')
          .mockReturnValueOnce('react')
          .mockReturnValueOnce('vue.js');

        const result = parser.parse(content);

        expect(mockNormalizer.normalize).toHaveBeenCalledWith('JavaScript');
        expect(mockNormalizer.normalize).toHaveBeenCalledWith('REACT');
        expect(mockNormalizer.normalize).toHaveBeenCalledWith('Vue.js');
        expect(result).toEqual(['javascript', 'react', 'vue.js']);
      });

      it('should only normalize tags that pass validation', () => {
        const content = 'valid-tag invalid{}';
        mockValidator.validate
          .mockReturnValueOnce({ isValid: true, errors: [], tag: 'valid-tag' })
          .mockReturnValueOnce({
            isValid: false,
            errors: ['Invalid'],
            tag: 'invalid{}',
          });
        mockNormalizer.normalize.mockReturnValueOnce('valid-tag');

        const result = parser.parse(content);

        expect(mockNormalizer.normalize).toHaveBeenCalledTimes(1);
        expect(mockNormalizer.normalize).toHaveBeenCalledWith('valid-tag');
        expect(result).toEqual(['valid-tag']);
      });
    });
  });
});
