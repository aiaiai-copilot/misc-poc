/**
 * Common validation schemas
 */
import { z } from 'zod';

// UUID validation
export const uuidSchema = z.string().uuid();

// Email validation
export const emailSchema = z.string().email();

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Sort order schema
export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');

// Common response metadata
export const responseMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

// API error schema
export const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime(),
});

// Success response wrapper
export const successResponseSchema = <T>(
  dataSchema: z.ZodType<T>
): z.ZodObject<{
  success: z.ZodLiteral<true>;
  data: z.ZodType<T>;
  meta: z.ZodOptional<typeof responseMetaSchema>;
}> =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: responseMetaSchema.optional(),
  });

// Error response wrapper
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
});
