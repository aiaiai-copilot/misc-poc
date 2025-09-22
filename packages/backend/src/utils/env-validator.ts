import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .default(3000),
  HOST: z.string().default('localhost'),

  // PostgreSQL Database
  POSTGRES_DB: z.string().min(1, 'Database name is required'),
  POSTGRES_USER: z.string().min(1, 'Database user is required'),
  POSTGRES_PASSWORD: z
    .string()
    .min(8, 'Database password must be at least 8 characters'),
  DATABASE_URL: z.string().url('Invalid database URL format'),

  // Database Connection Pool
  DB_POOL_MIN: z.string().transform(Number).pipe(z.number().min(1)).default(2),
  DB_POOL_MAX: z.string().transform(Number).pipe(z.number().min(1)).default(10),
  DB_CONNECTION_TIMEOUT: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1000))
    .default(30000),

  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Google OAuth (optional in development)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated environment configuration
 * @throws Error if validation fails
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env
): EnvConfig {
  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages =
        error.issues
          ?.map((err) => `${err.path.join('.')}: ${err.message}`)
          .join('\n') ||
        error.message ||
        'Unknown validation error';

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Validates required production environment variables
 * @param env - Environment configuration
 */
export function validateProductionEnv(env: EnvConfig): void {
  const requiredInProduction = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ] as const;

  if (env.NODE_ENV === 'production') {
    const missing = requiredInProduction.filter((key) => !env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`
      );
    }

    // Check for default/insecure values in production
    const insecureValues = [
      'your_secure_password_here',
      'your_super_secret_jwt_key_change_me',
      'your_refresh_secret_change_me',
      'change_me',
    ];

    const insecureVars = [];
    if (insecureValues.some((val) => env.POSTGRES_PASSWORD.includes(val))) {
      insecureVars.push('POSTGRES_PASSWORD');
    }
    if (insecureValues.some((val) => env.JWT_SECRET.includes(val))) {
      insecureVars.push('JWT_SECRET');
    }
    if (insecureValues.some((val) => env.JWT_REFRESH_SECRET.includes(val))) {
      insecureVars.push('JWT_REFRESH_SECRET');
    }

    if (insecureVars.length > 0) {
      throw new Error(
        `Insecure default values detected in production for: ${insecureVars.join(', ')}`
      );
    }
  }
}

/**
 * Gets validated environment configuration
 * @returns Validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  const config = validateEnv();
  validateProductionEnv(config);
  return config;
}
