import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random string
 * @param length - Length of the generated string
 * @param charset - Character set to use (default: alphanumeric + special chars)
 * @returns Secure random string
 */
export function generateSecureSecret(
  length: number = 64,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
): string {
  let result = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += charset[byte % charset.length];
    }
  }

  return result;
}

/**
 * Generates a secure password for database
 * @param length - Password length (default: 32)
 * @returns Secure database password
 */
export function generateDatabasePassword(length: number = 32): string {
  // Use alphanumeric chars only for database passwords to avoid shell escaping issues
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return generateSecureSecret(length, charset);
}

/**
 * Generates a secure JWT secret
 * @param length - Secret length (default: 64)
 * @returns Secure JWT secret
 */
export function generateJWTSecret(length: number = 64): string {
  return generateSecureSecret(length);
}

/**
 * Generates a complete .env file template with secure secrets
 * @param options - Configuration options
 * @returns .env file content with generated secrets
 */
export function generateEnvTemplate(
  options: {
    nodeEnv?: string;
    port?: number;
    host?: string;
    databaseName?: string;
    databaseUser?: string;
  } = {}
): string {
  const {
    nodeEnv = 'development',
    port = 3000,
    host = 'localhost',
    databaseName = 'misc_poc_dev',
    databaseUser = 'postgres',
  } = options;

  const dbPassword = generateDatabasePassword();
  const jwtSecret = generateJWTSecret();
  const jwtRefreshSecret = generateJWTSecret();

  return `# Environment Configuration
NODE_ENV="${nodeEnv}"
PORT=${port}
HOST="${host}"

# PostgreSQL Database Configuration
POSTGRES_DB="${databaseName}"
POSTGRES_USER="${databaseUser}"
POSTGRES_PASSWORD="${dbPassword}"
DATABASE_URL="postgresql://${databaseUser}:${dbPassword}@localhost:5432/${databaseName}"

# Database Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT=30000

# JWT Authentication Configuration
JWT_SECRET="${jwtSecret}"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"
JWT_REFRESH_EXPIRES_IN="7d"

# Google OAuth Configuration (Fill in your actual values)
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
GOOGLE_REDIRECT_URI="http://localhost:${port}/auth/google/callback"
`;
}

/**
 * CLI tool to generate secure .env file
 */
export function main(): void {
  const args = process.argv.slice(2);
  const helpText = `
Usage: node generate-secrets.js [options]

Options:
  --help                Show this help message
  --env=[env]          Environment (development, production, test)
  --port=[port]        Server port (default: 3000)
  --host=[host]        Server host (default: localhost)
  --db=[name]          Database name (default: misc_poc_dev)
  --user=[user]        Database user (default: postgres)

Examples:
  node generate-secrets.js --env=production --port=8080
  node generate-secrets.js --db=misc_poc_prod --user=app_user
`;

  if (args.includes('--help')) {
    console.log(helpText);
    return;
  }

  const options: Parameters<typeof generateEnvTemplate>[0] = {};

  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (value !== undefined) {
      switch (key) {
        case '--env':
          options.nodeEnv = value;
          break;
        case '--port':
          options.port = parseInt(value, 10);
          break;
        case '--host':
          options.host = value;
          break;
        case '--db':
          options.databaseName = value;
          break;
        case '--user':
          options.databaseUser = value;
          break;
      }
    }
  }

  console.log('# Generated secure .env configuration:');
  console.log(generateEnvTemplate(options));
  console.log('\n# Save this to your .env file and customize as needed.');
  console.log('# IMPORTANT: Never commit the .env file to version control!');
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
