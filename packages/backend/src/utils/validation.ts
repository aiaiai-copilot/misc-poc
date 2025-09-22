/**
 * Validation utilities for request processing
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Extend Express Request interface to include validated data
 */
declare global {
  namespace Express {
    interface Request {
      validated?: unknown;
    }
  }
}

/**
 * Express middleware factory for validating request data with Zod schemas
 */
export const validateRequest = <T>(
  schema: z.ZodType<T>,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.issues.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { errors },
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Attach validated data to request object
      req.validated = result.data;
      next();
    } catch {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal validation error',
          code: 'VALIDATION_INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

/**
 * Validate data against a schema and return result
 */
export const validateData = <T>(schema: z.ZodType<T>, data: unknown): T => {
  return schema.parse(data);
};

/**
 * Safely validate data against a schema
 */
export const safeValidateData = <T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } => {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
};
