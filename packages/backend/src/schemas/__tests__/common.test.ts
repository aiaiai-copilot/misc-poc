/**
 * Tests for common validation schemas
 */
import {
  uuidSchema,
  emailSchema,
  paginationSchema,
  sortOrderSchema,
  responseMetaSchema,
  apiErrorSchema,
  successResponseSchema,
  errorResponseSchema,
} from '../common.js';

describe('Common Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should validate valid UUIDs', () => {
      const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      expect(() => uuidSchema.parse(validUuid)).not.toThrow();
    });

    it('should reject invalid UUIDs', () => {
      const invalidUuid = 'not-a-uuid';
      expect(() => uuidSchema.parse(invalidUuid)).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should validate valid emails', () => {
      const validEmail = 'test@example.com';
      expect(() => emailSchema.parse(validEmail)).not.toThrow();
    });

    it('should reject invalid emails', () => {
      const invalidEmail = 'not-an-email';
      expect(() => emailSchema.parse(invalidEmail)).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination params', () => {
      const validPagination = { page: 1, limit: 10 };
      const result = paginationSchema.parse(validPagination);
      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should apply default values', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.parse({ page: '2', limit: '20' });
      expect(result).toEqual({ page: 2, limit: 20 });
    });

    it('should reject invalid pagination params', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
      expect(() => paginationSchema.parse({ page: -1 })).toThrow();
    });
  });

  describe('sortOrderSchema', () => {
    it('should validate valid sort orders', () => {
      expect(sortOrderSchema.parse('asc')).toBe('asc');
      expect(sortOrderSchema.parse('desc')).toBe('desc');
    });

    it('should apply default value', () => {
      expect(sortOrderSchema.parse(undefined)).toBe('asc');
    });

    it('should reject invalid sort orders', () => {
      expect(() => sortOrderSchema.parse('invalid')).toThrow();
    });
  });

  describe('successResponseSchema', () => {
    it('should validate success response with data', () => {
      const stringSchema = successResponseSchema(uuidSchema);
      const validResponse = {
        success: true,
        data: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      };
      expect(() => stringSchema.parse(validResponse)).not.toThrow();
    });

    it('should validate success response with meta', () => {
      const stringSchema = successResponseSchema(uuidSchema);
      const validResponse = {
        success: true,
        data: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        meta: { page: 1, limit: 10, total: 100, totalPages: 10 },
      };
      expect(() => stringSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('errorResponseSchema', () => {
    it('should validate error response', () => {
      const validErrorResponse = {
        success: false,
        error: {
          message: 'Something went wrong',
          timestamp: new Date().toISOString(),
        },
      };
      expect(() => errorResponseSchema.parse(validErrorResponse)).not.toThrow();
    });
  });
});
