/**
 * Tests for validation utilities
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import {
  validateRequest,
  validateData,
  safeValidateData,
} from '../validation.js';

// Mock Express request/response objects
const mockRequest = (
  data: unknown,
  source: 'body' | 'query' | 'params' = 'body'
): Request =>
  ({
    [source]: data,
  }) as Request;

const mockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('Validation Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('should validate valid request body and call next', () => {
      const req = mockRequest({ name: 'John', age: 25 });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((req as any).validated).toEqual({ name: 'John', age: 25 });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate request query params', () => {
      const req = mockRequest({ name: 'John', age: '25' }, 'query');
      const res = mockResponse();
      const querySchema = z.object({
        name: z.string(),
        age: z.coerce.number(),
      });
      const middleware = validateRequest(querySchema, 'query');

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((req as any).validated).toEqual({ name: 'John', age: 25 });
    });

    it('should return 400 for invalid request data', () => {
      const req = mockRequest({ name: '', age: -5 });
      const res = mockResponse();
      const middleware = validateRequest(testSchema);

      middleware(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                path: 'name',
                message: expect.any(String),
                code: expect.any(String),
              }),
              expect.objectContaining({
                path: 'age',
                message: expect.any(String),
                code: expect.any(String),
              }),
            ]),
          }),
          timestamp: expect.any(String),
        }),
      });
    });

    it('should handle validation errors gracefully', () => {
      const req = mockRequest({ name: 'John', age: 25 });
      const res = mockResponse();

      // Create a schema that will throw during validation
      const throwingSchema = {
        safeParse: jest.fn().mockImplementation(() => {
          throw new Error('Schema error');
        }),
      } as any;

      const middleware = validateRequest(throwingSchema);

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal validation error',
          code: 'VALIDATION_INTERNAL_ERROR',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('validateData', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should validate and return parsed data', () => {
      const data = { name: 'John', age: 25 };
      const result = validateData(testSchema, data);
      expect(result).toEqual(data);
    });

    it('should throw on invalid data', () => {
      const invalidData = { name: 'John', age: 'invalid' };
      expect(() => validateData(testSchema, invalidData)).toThrow();
    });
  });

  describe('safeValidateData', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should return success result for valid data', () => {
      const data = { name: 'John', age: 25 };
      const result = safeValidateData(testSchema, data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it('should return error result for invalid data', () => {
      const invalidData = { name: 'John', age: 'invalid' };
      const result = safeValidateData(testSchema, invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeInstanceOf(z.ZodError);
      }
    });
  });
});
