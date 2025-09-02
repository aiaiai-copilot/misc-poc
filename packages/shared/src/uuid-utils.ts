import { v4 as uuidv4 } from 'uuid';
import { Result, Ok, Err } from './result';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_WITHOUT_DASHES_REGEX = /^[0-9a-f]{32}$/i;

export function generateUuid(): string {
  return uuidv4();
}

export function validateUuid(uuid: string): Result<string, string> {
  if (typeof uuid !== 'string') {
    return Err('UUID must be a string');
  }

  if (!UUID_REGEX.test(uuid)) {
    return Err(`Invalid UUID format: ${uuid}`);
  }

  return Ok(uuid);
}

export function isValidUuid(uuid: string): boolean {
  return validateUuid(uuid).isOk();
}

export function parseUuid(input: string): Result<string, string> {
  if (typeof input !== 'string') {
    return Err('UUID input must be a string');
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Handle UUID without dashes
  if (UUID_WITHOUT_DASHES_REGEX.test(trimmed)) {
    const formatted = [
      trimmed.slice(0, 8),
      trimmed.slice(8, 12),
      trimmed.slice(12, 16),
      trimmed.slice(16, 20),
      trimmed.slice(20, 32)
    ].join('-');
    return Ok(formatted.toLowerCase());
  }

  // Handle UUID with dashes
  const normalized = trimmed.toLowerCase();
  if (UUID_REGEX.test(normalized)) {
    return Ok(normalized);
  }

  return Err(`Invalid UUID format: ${input}`);
}