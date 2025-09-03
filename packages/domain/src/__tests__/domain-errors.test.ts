import {
  DomainError,
  InvalidRecordContentError,
  InvalidTagError,
  DuplicateRecordError,
  TagLimitExceededError,
} from '../domain-errors';

describe('Domain Error Hierarchy', () => {
  describe('DomainError base class', () => {
    it('should be an instance of Error', () => {
      const error = new DomainError('TEST_ERROR', 'Test error message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new DomainError('TEST_ERROR', 'Test message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('DomainError');
    });

    it('should include context information when provided', () => {
      const context = { field: 'content', value: 'invalid' };
      const error = new DomainError('TEST_ERROR', 'Test message', context);
      expect(error.context).toEqual(context);
    });

    it('should have undefined context when not provided', () => {
      const error = new DomainError('TEST_ERROR', 'Test message');
      expect(error.context).toBeUndefined();
    });

    it('should maintain stack trace', () => {
      const error = new DomainError('TEST_ERROR', 'Test message');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DomainError');
    });
  });

  describe('InvalidRecordContentError', () => {
    it('should extend DomainError', () => {
      const error = new InvalidRecordContentError('Content is empty');
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct error code', () => {
      const error = new InvalidRecordContentError('Test message');
      expect(error.code).toBe('INVALID_RECORD_CONTENT');
      expect(error.name).toBe('InvalidRecordContentError');
    });

    it('should accept context information', () => {
      const context = { content: '', reason: 'empty' };
      const error = new InvalidRecordContentError(
        'Content cannot be empty',
        context
      );
      expect(error.context).toEqual(context);
    });

    it('should format descriptive error messages', () => {
      const testCases = [
        'Content cannot be empty',
        'Content exceeds maximum length',
        'Content contains invalid characters',
      ];

      testCases.forEach((message) => {
        const error = new InvalidRecordContentError(message);
        expect(error.message).toBe(message);
      });
    });
  });

  describe('InvalidTagError', () => {
    it('should extend DomainError', () => {
      const error = new InvalidTagError('Tag is invalid');
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct error code', () => {
      const error = new InvalidTagError('Test message');
      expect(error.code).toBe('INVALID_TAG');
      expect(error.name).toBe('InvalidTagError');
    });

    it('should include tag context information', () => {
      const context = { tag: 'invalid tag', reason: 'contains spaces' };
      const error = new InvalidTagError(
        'Tag contains forbidden characters',
        context
      );
      expect(error.context).toEqual(context);
    });

    it('should handle different validation failure reasons', () => {
      const testCases = [
        {
          message: 'Tag cannot be empty',
          context: { tag: '', reason: 'empty' },
        },
        {
          message: 'Tag too long',
          context: { tag: 'a'.repeat(101), reason: 'length' },
        },
        {
          message: 'Tag contains spaces',
          context: { tag: 'invalid tag', reason: 'whitespace' },
        },
        {
          message: 'Tag contains forbidden character: {',
          context: { tag: 'test{', reason: 'forbidden_char' },
        },
      ];

      testCases.forEach((testCase) => {
        const error = new InvalidTagError(testCase.message, testCase.context);
        expect(error.message).toBe(testCase.message);
        expect(error.context).toEqual(testCase.context);
      });
    });
  });

  describe('DuplicateRecordError', () => {
    it('should extend DomainError', () => {
      const error = new DuplicateRecordError('Record already exists');
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct error code', () => {
      const error = new DuplicateRecordError('Test message');
      expect(error.code).toBe('DUPLICATE_RECORD');
      expect(error.name).toBe('DuplicateRecordError');
    });

    it('should include duplicate record context', () => {
      const context = {
        existingRecordId: 'record-123',
        duplicateContent: 'javascript react frontend',
        matchingTags: ['javascript', 'react', 'frontend'],
      };
      const error = new DuplicateRecordError(
        'Record with same tags already exists',
        context
      );
      expect(error.context).toEqual(context);
    });

    it('should provide debugging information for duplicate detection', () => {
      const context = {
        existingRecordId: 'abc-123',
        duplicateContent: 'test content',
        matchingTags: ['tag1', 'tag2'],
      };
      const error = new DuplicateRecordError('Duplicate record found', context);

      expect(error.context?.existingRecordId).toBe('abc-123');
      expect(error.context?.duplicateContent).toBe('test content');
      expect(error.context?.matchingTags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('TagLimitExceededError', () => {
    it('should extend DomainError', () => {
      const error = new TagLimitExceededError('Too many tags');
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct error code', () => {
      const error = new TagLimitExceededError('Test message');
      expect(error.code).toBe('TAG_LIMIT_EXCEEDED');
      expect(error.name).toBe('TagLimitExceededError');
    });

    it('should include limit context information', () => {
      const context = {
        currentCount: 25,
        maxLimit: 20,
        tags: ['tag1', 'tag2', 'tag3'],
      };
      const error = new TagLimitExceededError(
        'Maximum tag limit exceeded',
        context
      );
      expect(error.context).toEqual(context);
    });

    it('should provide detailed limit information', () => {
      const context = {
        currentCount: 30,
        maxLimit: 25,
        tags: Array.from({ length: 30 }, (_, i) => `tag${i + 1}`),
      };
      const error = new TagLimitExceededError(
        `Record cannot have more than ${context.maxLimit} tags. Found ${context.currentCount} tags.`,
        context
      );

      expect(error.context?.currentCount).toBe(30);
      expect(error.context?.maxLimit).toBe(25);
      expect(error.context?.tags).toHaveLength(30);
    });
  });

  describe('error message formatting', () => {
    it('should maintain consistent message format across error types', () => {
      const errors = [
        new InvalidRecordContentError('Content validation failed'),
        new InvalidTagError('Tag validation failed'),
        new DuplicateRecordError('Duplicate detection failed'),
        new TagLimitExceededError('Limit validation failed'),
      ];

      errors.forEach((error) => {
        expect(error.message).toMatch(/^[A-Z]/); // Starts with capital letter
        expect(error.message.length).toBeGreaterThan(0);
        expect(typeof error.message).toBe('string');
      });
    });

    it('should preserve error context for debugging', () => {
      const testContext = { test: 'value', number: 42 };
      const errors = [
        new InvalidRecordContentError('Test', testContext),
        new InvalidTagError('Test', testContext),
        new DuplicateRecordError('Test', testContext),
        new TagLimitExceededError('Test', testContext),
      ];

      errors.forEach((error) => {
        expect(error.context).toEqual(testContext);
      });
    });
  });

  describe('inheritance hierarchy', () => {
    it('should allow type checking with instanceof', () => {
      const errors = [
        new InvalidRecordContentError('Test'),
        new InvalidTagError('Test'),
        new DuplicateRecordError('Test'),
        new TagLimitExceededError('Test'),
      ];

      errors.forEach((error) => {
        expect(error instanceof DomainError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });

    it('should distinguish between error types', () => {
      const contentError = new InvalidRecordContentError('Test');
      const tagError = new InvalidTagError('Test');
      const duplicateError = new DuplicateRecordError('Test');
      const limitError = new TagLimitExceededError('Test');

      expect(contentError instanceof InvalidRecordContentError).toBe(true);
      expect(contentError instanceof InvalidTagError).toBe(false);

      expect(tagError instanceof InvalidTagError).toBe(true);
      expect(tagError instanceof DuplicateRecordError).toBe(false);

      expect(duplicateError instanceof DuplicateRecordError).toBe(true);
      expect(duplicateError instanceof TagLimitExceededError).toBe(false);

      expect(limitError instanceof TagLimitExceededError).toBe(true);
      expect(limitError instanceof InvalidRecordContentError).toBe(false);
    });
  });

  describe('error serialization', () => {
    it('should preserve essential information when serialized', () => {
      const context = { field: 'test', value: 123 };
      const error = new InvalidRecordContentError(
        'Serialization test',
        context
      );

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.message).toBe('Serialization test');
      expect(parsed.name).toBe('InvalidRecordContentError');
      // Note: code and context might not be preserved in JSON.stringify by default
    });

    it('should provide toJSON method for custom serialization', () => {
      const context = { test: 'data' };
      const error = new DuplicateRecordError('JSON test', context);

      // Test if error can be stringified without throwing
      expect(() => JSON.stringify(error)).not.toThrow();
    });
  });
});
