import { MigrationChecksumValidator } from '../migration-checksum-validator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TDD Tests for Migration Checksum Validator
 * Following PRD section 4.2.2 - Checksum validation and version control
 *
 * Tests cover:
 * - Checksum generation for migration files
 * - Version tracking and validation
 * - Detection of unauthorized changes
 * - Migration history integrity checking
 */

// Mock fs module for controlled testing
jest.mock('fs');
jest.mock('path');

const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;
const mockJoin = join as jest.MockedFunction<typeof join>;

describe('Migration Checksum Validator - TDD Contract Tests', () => {
  let validator: MigrationChecksumValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new MigrationChecksumValidator();
  });

  describe('Checksum Generation', () => {
    it('should generate SHA-256 checksum for migration file content', async () => {
      // Arrange
      const migrationContent = `
        import { MigrationInterface, QueryRunner } from "typeorm";

        export class TestMigration1234567890 implements MigrationInterface {
          async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query('CREATE TABLE test (id SERIAL PRIMARY KEY)');
          }

          async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query('DROP TABLE test');
          }
        }
      `;

      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));
      mockJoin.mockReturnValue('/path/to/migration.ts');

      // Act
      const checksum = await validator.generateChecksumForFile(
        '/path/to/migration.ts'
      );

      // Assert
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(checksum).toMatch(/^[a-f0-9]{64}$/); // Valid hex string
      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/path/to/migration.ts',
        'utf8'
      );
    });

    it('should generate different checksums for different file content', async () => {
      // Arrange
      const content1 = 'CREATE TABLE users (id SERIAL PRIMARY KEY)';
      const content2 = 'CREATE TABLE posts (id SERIAL PRIMARY KEY)';

      mockReadFileSync
        .mockReturnValueOnce(Buffer.from(content1))
        .mockReturnValueOnce(Buffer.from(content2));
      mockJoin.mockReturnValue('/path/to/migration.ts');

      // Act
      const checksum1 = await validator.generateChecksumForFile(
        '/path/to/migration1.ts'
      );
      const checksum2 = await validator.generateChecksumForFile(
        '/path/to/migration2.ts'
      );

      // Assert
      expect(checksum1).not.toBe(checksum2);
    });

    it('should generate same checksum for identical content', async () => {
      // Arrange
      const content = 'CREATE TABLE users (id SERIAL PRIMARY KEY)';
      mockReadFileSync.mockReturnValue(Buffer.from(content));
      mockJoin.mockReturnValue('/path/to/migration.ts');

      // Act
      const checksum1 = await validator.generateChecksumForFile(
        '/path/to/migration.ts'
      );
      const checksum2 = await validator.generateChecksumForFile(
        '/path/to/migration.ts'
      );

      // Assert
      expect(checksum1).toBe(checksum2);
    });

    it('should handle file reading errors gracefully', async () => {
      // Arrange
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      // Act & Assert
      await expect(
        validator.generateChecksumForFile('/nonexistent/path.ts')
      ).rejects.toThrow('Failed to generate checksum for migration file');
    });
  });

  describe('Migration Content Analysis', () => {
    it('should extract migration name from file content', async () => {
      // Arrange
      const migrationContent = `
        import { MigrationInterface, QueryRunner } from "typeorm";

        export class CreateUsersTable1758589440121 implements MigrationInterface {
          async up(queryRunner: QueryRunner): Promise<void> {}
          async down(queryRunner: QueryRunner): Promise<void> {}
        }
      `;

      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));

      // Act
      const migrationInfo = await validator.analyzeMigrationFile(
        '/path/to/migration.ts'
      );

      // Assert
      expect(migrationInfo.name).toBe('CreateUsersTable1758589440121');
      expect(migrationInfo.checksum).toBeDefined();
      expect(migrationInfo.timestamp).toBe('1758589440121');
    });

    it('should handle migration files without timestamp', async () => {
      // Arrange
      const migrationContent = `
        export class CreateUsersTable implements MigrationInterface {
          async up(queryRunner: QueryRunner): Promise<void> {}
        }
      `;

      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));

      // Act
      const migrationInfo = await validator.analyzeMigrationFile(
        '/path/to/migration.ts'
      );

      // Assert
      expect(migrationInfo.name).toBe('CreateUsersTable');
      expect(migrationInfo.timestamp).toBeNull();
    });

    it('should detect invalid migration file format', async () => {
      // Arrange
      const invalidContent = 'console.log("not a migration");';
      mockReadFileSync.mockReturnValue(Buffer.from(invalidContent));

      // Act & Assert
      await expect(
        validator.analyzeMigrationFile('/path/to/invalid.ts')
      ).rejects.toThrow('Invalid migration file format');
    });
  });

  describe('Checksum Validation', () => {
    it('should validate migration checksum against stored value', async () => {
      // Arrange
      const migrationContent = 'CREATE TABLE test (id SERIAL PRIMARY KEY)';
      const expectedChecksum =
        await validator.generateChecksumForContent(migrationContent);

      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));

      // Act
      const isValid = await validator.validateMigrationChecksum(
        '/path/to/migration.ts',
        expectedChecksum
      );

      // Assert
      expect(isValid).toBe(true);
    });

    it('should detect modified migration files', async () => {
      // Arrange
      const originalContent = 'CREATE TABLE test (id SERIAL PRIMARY KEY)';
      const modifiedContent =
        'CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(255))';

      const originalChecksum =
        await validator.generateChecksumForContent(originalContent);
      mockReadFileSync.mockReturnValue(Buffer.from(modifiedContent));

      // Act
      const isValid = await validator.validateMigrationChecksum(
        '/path/to/migration.ts',
        originalChecksum
      );

      // Assert
      expect(isValid).toBe(false);
    });

    it('should return validation result with details', async () => {
      // Arrange
      const content = 'CREATE TABLE test (id SERIAL PRIMARY KEY)';
      const wrongChecksum = 'invalid_checksum';

      mockReadFileSync.mockReturnValue(Buffer.from(content));

      // Act
      const result = await validator.validateMigrationWithDetails(
        '/path/to/migration.ts',
        wrongChecksum
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.expectedChecksum).toBe(wrongChecksum);
      expect(result.actualChecksum).toBeDefined();
      expect(result.migrationPath).toBe('/path/to/migration.ts');
    });
  });

  describe('Version Control Integration', () => {
    it('should generate version metadata for migration', async () => {
      // Arrange
      const migrationContent = `
        export class CreateUsersTable1758589440121 implements MigrationInterface {
          async up(queryRunner: QueryRunner): Promise<void> {}
        }
      `;

      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));

      // Act
      const metadata = await validator.generateMigrationMetadata(
        '/path/to/migration.ts'
      );

      // Assert
      expect(metadata.checksum).toBeDefined();
      expect(metadata.version).toBe('1.0.0'); // Default version
      expect(metadata.timestamp).toBeInstanceOf(Date);
      expect(metadata.migrationName).toBe('CreateUsersTable1758589440121');
      expect(metadata.filePath).toBe('/path/to/migration.ts');
    });

    it('should allow custom version specification', async () => {
      // Arrange
      const migrationContent = 'CREATE TABLE test (id SERIAL)';
      mockReadFileSync.mockReturnValue(Buffer.from(migrationContent));

      // Act
      const metadata = await validator.generateMigrationMetadata(
        '/path/to/migration.ts',
        '2.1.0'
      );

      // Assert
      expect(metadata.version).toBe('2.1.0');
    });
  });

  describe('Batch Operations', () => {
    it('should validate multiple migration files', async () => {
      // Arrange
      const migrations = [
        { path: '/path/to/migration1.ts', checksum: 'checksum1' },
        { path: '/path/to/migration2.ts', checksum: 'checksum2' },
      ];

      mockReadFileSync
        .mockReturnValueOnce(Buffer.from('content1'))
        .mockReturnValueOnce(Buffer.from('content2'));

      const content1Checksum =
        await validator.generateChecksumForContent('content1');
      const content2Checksum =
        await validator.generateChecksumForContent('content2');

      // Act
      const results = await validator.validateMultipleMigrations([
        { path: '/path/to/migration1.ts', checksum: content1Checksum },
        { path: '/path/to/migration2.ts', checksum: content2Checksum },
      ]);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
    });

    it('should report all validation failures in batch operation', async () => {
      // Arrange
      mockReadFileSync
        .mockReturnValueOnce(Buffer.from('modified_content1'))
        .mockReturnValueOnce(Buffer.from('modified_content2'));

      // Act
      const results = await validator.validateMultipleMigrations([
        { path: '/path/to/migration1.ts', checksum: 'wrong_checksum1' },
        { path: '/path/to/migration2.ts', checksum: 'wrong_checksum2' },
      ]);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(false);
      expect(results[1].isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty migration files', async () => {
      // Arrange
      mockReadFileSync.mockReturnValue(Buffer.from(''));

      // Act
      const checksum =
        await validator.generateChecksumForFile('/path/to/empty.ts');

      // Assert
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64);
    });

    it('should handle very large migration files', async () => {
      // Arrange
      const largeContent =
        'CREATE TABLE test (id SERIAL PRIMARY KEY);\n'.repeat(10000);
      mockReadFileSync.mockReturnValue(Buffer.from(largeContent));

      // Act
      const checksum =
        await validator.generateChecksumForFile('/path/to/large.ts');

      // Assert
      expect(checksum).toBeDefined();
      expect(checksum).toHaveLength(64);
    });

    it('should provide detailed error information for validation failures', async () => {
      // Arrange
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Act & Assert
      await expect(
        validator.validateMigrationChecksum(
          '/path/to/migration.ts',
          'some_checksum'
        )
      ).rejects.toThrow('Failed to validate migration checksum');
    });
  });
});
