import { createHash } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Migration Checksum Validator
 * Implements checksum validation and version control for database migrations
 * Following PRD section 4.2.2 requirements
 *
 * Features:
 * - SHA-256 checksum generation for migration files
 * - Migration file integrity validation
 * - Version tracking and metadata generation
 * - Batch validation operations
 * - Unauthorized change detection
 */

export interface MigrationInfo {
  name: string;
  checksum: string;
  timestamp: string | null;
  filePath: string;
}

export interface MigrationMetadata {
  checksum: string;
  version: string;
  timestamp: Date;
  migrationName: string;
  filePath: string;
}

export interface ValidationResult {
  isValid: boolean;
  expectedChecksum: string;
  actualChecksum: string;
  migrationPath: string;
  error?: string;
}

export interface MigrationValidationRequest {
  path: string;
  checksum: string;
}

export class MigrationChecksumValidator {
  /**
   * Generate SHA-256 checksum for migration file content
   */
  async generateChecksumForFile(filePath: string): Promise<string> {
    try {
      const content = readFileSync(filePath, 'utf8');
      return this.generateChecksumForContent(content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to generate checksum for migration file: ${errorMessage}`
      );
    }
  }

  /**
   * Generate SHA-256 checksum for string content
   */
  async generateChecksumForContent(content: string): Promise<string> {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Analyze migration file to extract metadata
   */
  async analyzeMigrationFile(filePath: string): Promise<MigrationInfo> {
    try {
      const content = readFileSync(filePath, 'utf8');
      const checksum = await this.generateChecksumForContent(content);

      // Extract migration class name using regex
      const classMatch = content.match(
        /export\s+class\s+(\w+)\s+implements\s+MigrationInterface/
      );
      if (!classMatch) {
        throw new Error(
          'Invalid migration file format: MigrationInterface not found'
        );
      }

      const migrationName = classMatch[1];

      // Extract timestamp if present in migration name
      const timestampMatch = migrationName.match(/(\d{13})$/); // 13-digit timestamp
      const timestamp = timestampMatch ? timestampMatch[1] : null;

      return {
        name: migrationName,
        checksum,
        timestamp,
        filePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze migration file: ${errorMessage}`);
    }
  }

  /**
   * Validate migration file checksum against expected value
   */
  async validateMigrationChecksum(
    filePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.generateChecksumForFile(filePath);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to validate migration checksum: ${errorMessage}`);
    }
  }

  /**
   * Validate migration with detailed results
   */
  async validateMigrationWithDetails(
    filePath: string,
    expectedChecksum: string
  ): Promise<ValidationResult> {
    try {
      const actualChecksum = await this.generateChecksumForFile(filePath);
      const isValid = actualChecksum === expectedChecksum;

      return {
        isValid,
        expectedChecksum,
        actualChecksum,
        migrationPath: filePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        expectedChecksum,
        actualChecksum: '',
        migrationPath: filePath,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate complete metadata for a migration file
   */
  async generateMigrationMetadata(
    filePath: string,
    version: string = '1.0.0'
  ): Promise<MigrationMetadata> {
    const migrationInfo = await this.analyzeMigrationFile(filePath);

    return {
      checksum: migrationInfo.checksum,
      version,
      timestamp: new Date(),
      migrationName: migrationInfo.name,
      filePath,
    };
  }

  /**
   * Validate multiple migrations in batch
   */
  async validateMultipleMigrations(
    requests: MigrationValidationRequest[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const request of requests) {
      const result = await this.validateMigrationWithDetails(
        request.path,
        request.checksum
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Check if migration file format is valid
   */
  isValidMigrationFile(content: string): boolean {
    // Check for required patterns in migration file
    const hasInterface = content.includes('implements MigrationInterface');
    const hasUpMethod = content.includes('async up(queryRunner: QueryRunner)');
    const hasDownMethod = content.includes(
      'async down(queryRunner: QueryRunner)'
    );

    return hasInterface && hasUpMethod && hasDownMethod;
  }

  /**
   * Extract migration timestamp from filename or class name
   */
  extractTimestamp(migrationIdentifier: string): string | null {
    const timestampMatch = migrationIdentifier.match(/(\d{13})/);
    return timestampMatch ? timestampMatch[1] : null;
  }

  /**
   * Generate migration history entry with checksum
   */
  async generateHistoryEntry(filePath: string, executedAt: Date = new Date()) {
    const migrationInfo = await this.analyzeMigrationFile(filePath);

    return {
      id: migrationInfo.timestamp
        ? parseInt(migrationInfo.timestamp)
        : Date.now(),
      timestamp: executedAt.getTime(),
      name: migrationInfo.name,
      checksum: migrationInfo.checksum,
      version: '1.0.0',
      filePath,
    };
  }
}
