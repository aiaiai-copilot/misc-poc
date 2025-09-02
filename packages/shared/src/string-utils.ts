import { Result, Ok, Err } from './result';

export function normalizeString(input: string): string {
  if (input == null) return '';
  return input.replace(/\s+/g, ' ').replace(/[\r\n]/g, ' ').trim();
}

export function slugify(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function truncate(input: string, maxLength: number, suffix = '...'): Result<string, string> {
  if (maxLength < 0) {
    return Err('maxLength must be non-negative');
  }
  
  if (input.length <= maxLength) {
    return Ok(input);
  }
  
  return Ok(input.slice(0, maxLength - suffix.length) + suffix);
}

export function sanitizeInput(input: string): Result<string, string> {
  try {
    // Basic XSS prevention - remove script tags and dangerous attributes
    const sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
    
    return Ok(sanitized);
  } catch (error) {
    return Err(`Failed to sanitize input: ${error}`);
  }
}

export function isEmptyOrWhitespace(input: string): boolean {
  return !input || input.trim().length === 0;
}