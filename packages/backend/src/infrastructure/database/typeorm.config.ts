import { AppDataSource, TestDataSource } from './data-source.js';

/**
 * TypeORM CLI configuration
 * This file is used by TypeORM CLI commands for generating and running migrations
 *
 * Usage:
 * - Generate migration: npx typeorm migration:generate -d src/infrastructure/database/typeorm.config.ts
 * - Run migrations: npx typeorm migration:run -d src/infrastructure/database/typeorm.config.ts
 * - Revert migration: npx typeorm migration:revert -d src/infrastructure/database/typeorm.config.ts
 */

// Export the appropriate DataSource for CLI usage
export default process.env.NODE_ENV === 'test' ? TestDataSource : AppDataSource;
