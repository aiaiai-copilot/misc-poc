import { StorageManager, type BackupData } from './storage-manager';
import {
  StorageSchema,
  type StorageSchemaV21,
  type LegacyStorageSchemaV20,
} from './storage-schema';

export interface MigrationScript {
  (schema: unknown): unknown;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string | null;
  toVersion: string | null;
  backupCreated: boolean;
  rolledBack: boolean;
  rollbackError?: string;
  integrityVerified: boolean;
  migrationSkipped: boolean;
  error?: string;
  timestamp: string;
}

export interface MigrationHistoryEntry {
  timestamp: string;
  fromVersion: string | null;
  toVersion: string | null;
  success: boolean;
  error?: string;
}

export class MigrationManager {
  private readonly storageManager: StorageManager;
  private readonly migrations = new Map<string, MigrationScript>();
  private readonly migrationHistory: MigrationHistoryEntry[] = [];
  private readonly maxHistoryEntries = 10;
  private readonly defaultTargetVersion = '2.1';

  constructor(storageManager: StorageManager, registerBuiltIns = true) {
    this.storageManager = storageManager;
    if (registerBuiltIns) {
      this.registerBuiltInMigrations();
    }
  }

  async getCurrentVersion(): Promise<string | null> {
    try {
      const schema = await this.storageManager.load();

      if (this.isStorageSchemaV21(schema)) {
        return schema.version;
      }

      if (this.isLegacyStorageSchemaV20(schema)) {
        return '2.0';
      }

      // Check for other known version formats
      if (schema && typeof schema === 'object' && 'version' in schema) {
        const version = (schema as { version?: unknown }).version;
        if (typeof version === 'string') {
          // Only return known versions, reject unknown ones
          const knownVersions = ['2.0', '2.1'];
          return knownVersions.includes(version) ? version : null;
        }
      }

      return null;
    } catch (error) {
      throw new Error(
        `Failed to get current version: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  registerMigration(
    fromVersion: string,
    toVersion: string,
    migrationScript: MigrationScript
  ): void {
    const key = `${fromVersion}->${toVersion}`;

    if (this.migrations.has(key)) {
      throw new Error(
        `Migration from ${fromVersion} to ${toVersion} already registered`
      );
    }

    this.migrations.set(key, migrationScript);
  }

  clearMigrations(): void {
    this.migrations.clear();
  }

  async migrate(
    targetVersion: string = this.defaultTargetVersion
  ): Promise<MigrationResult> {
    const timestamp = new Date().toISOString();
    let backup: BackupData | null = null;

    try {
      const currentVersion = await this.getCurrentVersion();

      const result: MigrationResult = {
        success: false,
        fromVersion: currentVersion,
        toVersion: null,
        backupCreated: false,
        rolledBack: false,
        integrityVerified: false,
        migrationSkipped: false,
        timestamp,
      };

      // Check if migration is needed
      if (currentVersion === targetVersion) {
        result.success = true;
        result.toVersion = targetVersion;
        result.migrationSkipped = true;
        this.addToHistory(result);
        return result;
      }

      // Find migration path
      const migrationPath = this.findMigrationPath(
        currentVersion,
        targetVersion
      );
      if (!migrationPath || migrationPath.length === 0) {
        result.error = `No migration path found from version ${currentVersion} to ${targetVersion}`;
        this.addToHistory(result);
        return result;
      }

      // Create backup before migration
      try {
        backup = await this.storageManager.createBackup();
        result.backupCreated = true;
      } catch (error) {
        result.error = `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.addToHistory(result);
        return result;
      }

      // Load current data
      let currentSchema = await this.storageManager.load();

      // Execute migration path
      for (const step of migrationPath) {
        const migrationKey = `${step.from}->${step.to}`;
        const migrationScript = this.migrations.get(migrationKey);

        if (!migrationScript) {
          throw new Error(`Migration script not found: ${migrationKey}`);
        }

        try {
          currentSchema = migrationScript(currentSchema) as StorageSchemaV21;
        } catch (error) {
          throw new Error(
            `Migration script failed (${migrationKey}): ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Save migrated data
      try {
        await this.storageManager.save(currentSchema);
      } catch (error) {
        throw new Error(
          `Failed to save migrated data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Verify data integrity
      try {
        const integrityValid =
          await this.storageManager.verifyIntegrity(currentSchema);
        result.integrityVerified = integrityValid;

        if (!integrityValid) {
          throw new Error('Data integrity verification failed after migration');
        }
      } catch (error) {
        throw new Error(
          `Data integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Migration successful
      result.success = true;
      result.toVersion = targetVersion;
      this.addToHistory(result);
      return result;
    } catch (error) {
      const result: MigrationResult = {
        success: false,
        fromVersion: await this.getCurrentVersion().catch(() => null),
        toVersion: null,
        backupCreated: backup !== null,
        rolledBack: false,
        integrityVerified: false,
        migrationSkipped: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };

      // Attempt rollback if backup exists
      if (backup) {
        try {
          await this.storageManager.restoreFromBackup(backup);
          result.rolledBack = true;
        } catch (rollbackError) {
          result.rollbackError =
            rollbackError instanceof Error
              ? rollbackError.message
              : 'Unknown rollback error';
        }
      }

      this.addToHistory(result);
      return result;
    }
  }

  async rollback(
    backup: BackupData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.storageManager.restoreFromBackup(backup);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getMigrationHistory(): MigrationHistoryEntry[] {
    return [...this.migrationHistory];
  }

  private registerBuiltInMigrations(): void {
    // Built-in migration from v2.0 to v2.1
    this.registerMigration(
      '2.0',
      '2.1',
      (schema: unknown): StorageSchemaV21 => {
        return StorageSchema.migrate(schema as LegacyStorageSchemaV20);
      }
    );
  }

  private findMigrationPath(
    fromVersion: string | null,
    toVersion: string
  ): Array<{ from: string; to: string }> | null {
    if (fromVersion === null) {
      return null;
    }

    if (fromVersion === toVersion) {
      return [];
    }

    // Check for direct migration first
    const directKey = `${fromVersion}->${toVersion}`;
    if (this.migrations.has(directKey)) {
      return [{ from: fromVersion, to: toVersion }];
    }

    // Implement simple multi-step migration using BFS
    const visited = new Set<string>();
    const queue: Array<{
      version: string;
      path: Array<{ from: string; to: string }>;
    }> = [{ version: fromVersion, path: [] }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.version)) {
        continue;
      }
      visited.add(current.version);

      // Find all possible next versions from current version
      for (const [migrationKey] of this.migrations.entries()) {
        const parts = migrationKey.split('->');
        if (parts.length !== 2) continue;

        const [from, to] = parts;
        if (!from || !to) continue;

        if (from === current.version && !visited.has(to)) {
          const newPath = [...current.path, { from, to }];

          if (to === toVersion) {
            return newPath;
          }

          queue.push({ version: to, path: newPath });
        }
      }
    }

    return null; // No path found
  }

  private addToHistory(result: MigrationResult): void {
    const historyEntry: MigrationHistoryEntry = {
      timestamp: result.timestamp,
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      success: result.success,
      error: result.error,
    };

    this.migrationHistory.unshift(historyEntry);

    // Limit history size
    if (this.migrationHistory.length > this.maxHistoryEntries) {
      this.migrationHistory.splice(this.maxHistoryEntries);
    }
  }

  private isStorageSchemaV21(schema: unknown): schema is StorageSchemaV21 {
    return StorageSchema.isValid(schema);
  }

  private isLegacyStorageSchemaV20(
    schema: unknown
  ): schema is LegacyStorageSchemaV20 {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const schemaObj = schema as Record<string, unknown>;
    return (
      schemaObj.version === '2.0' &&
      Array.isArray(schemaObj.tags) &&
      Array.isArray(schemaObj.records)
    );
  }
}
