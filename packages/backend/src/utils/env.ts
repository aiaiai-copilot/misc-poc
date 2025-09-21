/**
 * Environment variable validation utilities
 */

export interface RequiredEnvVars {
  [key: string]: string | undefined;
}

/**
 * Validate that all required environment variables are present
 */
export function validateEnv(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing
        .map((v) => `  - ${v}`)
        .join(
          '\n'
        )}\n\nPlease check your .env file or environment configuration.`
    );
  }
}

/**
 * Get environment variable with fallback value
 */
export function getEnvVar(
  name: string,
  defaultValue?: string,
  required: boolean = false
): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    if (required && !defaultValue) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return defaultValue || '';
  }

  return value.trim();
}

/**
 * Get boolean environment variable
 */
export function getBooleanEnvVar(
  name: string,
  defaultValue: boolean = false
): boolean {
  const value = getEnvVar(name);
  if (!value) return defaultValue;

  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Get number environment variable
 */
export function getNumberEnvVar(
  name: string,
  defaultValue?: number,
  required: boolean = false
): number {
  const value = getEnvVar(name, undefined, required);

  if (!value && defaultValue !== undefined) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    if (required) {
      throw new Error(`Environment variable ${name} must be a valid number`);
    }
    return defaultValue || 0;
  }

  return parsed;
}
