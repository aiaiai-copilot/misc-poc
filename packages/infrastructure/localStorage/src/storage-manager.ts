import {
  StorageSchema,
  StorageSchemaV21,
  LegacyStorageSchemaV20,
} from './storage-schema';
import { Result, Ok, Err } from '@misc-poc/shared';

export interface QuotaInfo {
  used: number;
  available: number;
  total: number;
  percentUsed: number;
}

export interface BackupInfo {
  key: string;
  timestamp: Date;
  size: number;
}

export type UpdateFunction = (
  schema: StorageSchemaV21
) => Promise<Result<StorageSchemaV21, string>>;

export class StorageManager {
  private static readonly DEFAULT_STORAGE_KEY = 'misc-poc-app-data';
  private static readonly BACKUP_PREFIX = 'backup-';

  constructor(
    private readonly storageKey: string = StorageManager.DEFAULT_STORAGE_KEY
  ) {}

  async load(): Promise<Result<StorageSchemaV21, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      const data = localStorage.getItem(this.storageKey);

      if (!data) {
        return Ok(StorageSchema.createEmpty());
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (error) {
        return Err(
          `Failed to parse storage data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      if (StorageSchema.needsMigration(parsed)) {
        if (
          parsed &&
          typeof parsed === 'object' &&
          'version' in parsed &&
          parsed.version === '2.0'
        ) {
          const legacySchema = parsed as LegacyStorageSchemaV20;
          const migratedSchema = StorageSchema.migrate(legacySchema);

          // Save migrated schema back to localStorage
          const saveResult = await this.save(migratedSchema);
          if (saveResult.isErr()) {
            return Err(
              `Failed to save migrated schema: ${saveResult.unwrapErr()}`
            );
          }

          return Ok(migratedSchema);
        }

        return Err('Unsupported schema version or invalid schema structure');
      }

      if (!StorageSchema.isValid(parsed)) {
        return Err('Invalid storage schema structure');
      }

      return Ok(parsed as StorageSchemaV21);
    } catch (error) {
      return Err(
        `Failed to access localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async save(schema: StorageSchemaV21): Promise<Result<void, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      const json = StorageSchema.toJSON(schema);
      localStorage.setItem(this.storageKey, json);

      return Ok(undefined);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('QuotaExceededError') ||
          error.name === 'QuotaExceededError'
        ) {
          return Err('Storage quota exceeded. Unable to save data.');
        }
        return Err(`Failed to save to localStorage: ${error.message}`);
      }
      return Err('Failed to save to localStorage: Unknown error');
    }
  }

  async clear(): Promise<Result<void, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      localStorage.removeItem(this.storageKey);
      return Ok(undefined);
    } catch (error) {
      return Err(
        `Failed to clear localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getQuotaInfo(): Promise<Result<QuotaInfo, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      let currentUsed = this.calculateCurrentUsage();
      let totalQuota = 5 * 1024 * 1024; // 5MB default

      // Try to detect quota by testing storage capacity
      const testKey = `${this.storageKey}-quota-test`;

      try {
        // Test with progressively larger chunks to find quota
        let testSize = 1024; // Start with 1KB
        let maxTestSize = 0;

        while (testSize <= 10 * 1024 * 1024) {
          // Up to 10MB
          const testData = 'x'.repeat(testSize);
          try {
            localStorage.setItem(testKey, testData);
            maxTestSize = testSize;
            localStorage.removeItem(testKey);
            testSize *= 2;
          } catch {
            break;
          }
        }

        if (maxTestSize > 0) {
          totalQuota = Math.max(currentUsed + maxTestSize, 5 * 1024 * 1024);
        }
      } catch {
        // Use fallback quota if detection fails
        totalQuota = 5 * 1024 * 1024; // 5MB fallback
      }

      const available = Math.max(0, totalQuota - currentUsed);
      const percentUsed = totalQuota > 0 ? (currentUsed / totalQuota) * 100 : 0;

      return Ok({
        used: currentUsed,
        available,
        total: totalQuota,
        percentUsed,
      });
    } catch (error) {
      return Err(
        `Failed to determine storage quota: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async isQuotaAvailable(
    schema: StorageSchemaV21
  ): Promise<Result<boolean, string>> {
    try {
      const json = StorageSchema.toJSON(schema);
      const requiredSize = this.storageKey.length + json.length;

      // Test if we can actually store this data
      try {
        const testKey = `${this.storageKey}-quota-test`;
        localStorage.setItem(testKey, json);
        localStorage.removeItem(testKey);
        return Ok(true);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('QuotaExceededError') ||
            error.name === 'QuotaExceededError')
        ) {
          return Ok(false);
        }
        // If it's some other error, fall back to calculation
      }

      const quotaResult = await this.getQuotaInfo();
      if (quotaResult.isErr()) {
        return Err(quotaResult.unwrapErr());
      }

      const quotaInfo = quotaResult.unwrap();
      return Ok(requiredSize <= quotaInfo.available);
    } catch (error) {
      return Err(
        `Failed to check quota availability: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async validateIntegrity(
    schema: StorageSchemaV21
  ): Promise<Result<string[], string>> {
    try {
      const issues: string[] = [];

      // Validate normalizedToTagId index
      for (const [normalizedValue, tagId] of Object.entries(
        schema.indexes.normalizedToTagId
      )) {
        if (!schema.tags[tagId]) {
          issues.push(
            `normalizedToTagId index references non-existent tag: ${tagId} for normalized value: ${normalizedValue}`
          );
        }
      }

      // Check if all tags have corresponding index entries
      for (const [tagId, tagData] of Object.entries(schema.tags)) {
        if (
          schema.indexes.normalizedToTagId[tagData.normalizedValue] !== tagId
        ) {
          issues.push(
            `normalizedToTagId index missing entry for tag: ${tagId} with normalized value: ${tagData.normalizedValue}`
          );
        }
      }

      // Validate tagToRecords index
      for (const [tagId, recordIds] of Object.entries(
        schema.indexes.tagToRecords
      )) {
        if (!schema.tags[tagId]) {
          issues.push(
            `tagToRecords index references non-existent tag: ${tagId}`
          );
        }

        for (const recordId of recordIds) {
          if (!schema.records[recordId]) {
            issues.push(
              `tagToRecords index references non-existent record: ${recordId} for tag: ${tagId}`
            );
          }
        }
      }

      // Validate records
      for (const [recordId, recordData] of Object.entries(schema.records)) {
        for (const tagId of recordData.tagIds) {
          if (!schema.tags[tagId]) {
            issues.push(
              `Record ${recordId} references non-existent tag: ${tagId}`
            );
          } else {
            // Check if tagToRecords index includes this record
            const indexRecords = schema.indexes.tagToRecords[tagId] || [];
            if (!indexRecords.includes(recordId)) {
              issues.push(
                `tagToRecords index missing record ${recordId} for tag ${tagId}`
              );
            }
          }
        }
      }

      return Ok(issues);
    } catch (error) {
      return Err(
        `Failed to validate data integrity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async repairData(
    schema: StorageSchemaV21
  ): Promise<Result<StorageSchemaV21, string>> {
    try {
      const repairedSchema: StorageSchemaV21 = {
        version: '2.1',
        tags: { ...schema.tags },
        records: { ...schema.records },
        indexes: {
          normalizedToTagId: {},
          tagToRecords: {},
        },
      };

      // Rebuild normalizedToTagId index
      for (const [tagId, tagData] of Object.entries(repairedSchema.tags)) {
        repairedSchema.indexes.normalizedToTagId[tagData.normalizedValue] =
          tagId;
      }

      // Rebuild tagToRecords index
      for (const [recordId, recordData] of Object.entries(
        repairedSchema.records
      )) {
        for (const tagId of recordData.tagIds) {
          if (repairedSchema.tags[tagId]) {
            // Only add if tag exists
            if (!repairedSchema.indexes.tagToRecords[tagId]) {
              repairedSchema.indexes.tagToRecords[tagId] = [];
            }
            if (
              !repairedSchema.indexes.tagToRecords[tagId].includes(recordId)
            ) {
              repairedSchema.indexes.tagToRecords[tagId].push(recordId);
            }
          }
        }
      }

      // Remove references to non-existent tags from records
      for (const [recordId, recordData] of Object.entries(
        repairedSchema.records
      )) {
        const validTagIds = recordData.tagIds.filter(
          (tagId) => repairedSchema.tags[tagId]
        );
        if (validTagIds.length !== recordData.tagIds.length) {
          repairedSchema.records[recordId] = {
            ...recordData,
            tagIds: validTagIds,
          };
        }
      }

      return Ok(repairedSchema);
    } catch (error) {
      return Err(
        `Failed to repair data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createBackup(): Promise<Result<string, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      const loadResult = await this.load();
      if (loadResult.isErr()) {
        return Err(
          `Failed to load current data for backup: ${loadResult.unwrapErr()}`
        );
      }

      const currentData = loadResult.unwrap();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `${StorageManager.BACKUP_PREFIX}${this.storageKey}-${timestamp}`;

      try {
        localStorage.setItem(backupKey, StorageSchema.toJSON(currentData));
        return Ok(backupKey);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('QuotaExceededError') ||
            error.name === 'QuotaExceededError')
        ) {
          return Err('Failed to create backup: Storage quota exceeded');
        }
        return Err(
          `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } catch (error) {
      return Err(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async restoreFromBackup(backupKey: string): Promise<Result<void, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        return Err(`Backup not found: ${backupKey}`);
      }

      let schema: StorageSchemaV21;
      try {
        schema = StorageSchema.fromJSON(backupData);
      } catch (error) {
        return Err(
          `Invalid backup data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      const saveResult = await this.save(schema);
      if (saveResult.isErr()) {
        return Err(`Failed to restore from backup: ${saveResult.unwrapErr()}`);
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listBackups(): Promise<Result<BackupInfo[], string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      const backups: BackupInfo[] = [];
      const backupPrefix = `${StorageManager.BACKUP_PREFIX}${this.storageKey}`;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(backupPrefix)) {
          const data = localStorage.getItem(key);
          if (data) {
            // Extract timestamp from key
            const timestampPart = key.substring(backupPrefix.length + 1);
            const timestampStr = timestampPart
              .replace(/-/g, ':')
              .replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3');

            let timestamp: Date;
            try {
              timestamp = new Date(timestampStr);
              if (isNaN(timestamp.getTime())) {
                // Fallback to current time if parsing fails
                timestamp = new Date();
              }
            } catch {
              timestamp = new Date();
            }

            backups.push({
              key,
              timestamp,
              size: data.length,
            });
          }
        }
      }

      // Sort by timestamp, newest first
      backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return Ok(backups);
    } catch (error) {
      return Err(
        `Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteBackup(backupKey: string): Promise<Result<void, string>> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return Err('localStorage is not available');
      }

      localStorage.removeItem(backupKey);
      return Ok(undefined);
    } catch (error) {
      return Err(
        `Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async atomicUpdate(updateFn: UpdateFunction): Promise<Result<void, string>> {
    // Create backup before making changes
    const backupResult = await this.createBackup();
    if (backupResult.isErr()) {
      return Err(
        `Failed to create backup before update: ${backupResult.unwrapErr()}`
      );
    }

    const backupKey = backupResult.unwrap();

    try {
      // Load current data
      const loadResult = await this.load();
      if (loadResult.isErr()) {
        await this.deleteBackup(backupKey); // Clean up backup
        return Err(`Failed to load data for update: ${loadResult.unwrapErr()}`);
      }

      const currentSchema = loadResult.unwrap();

      // Apply update function
      const updateResult = await updateFn(currentSchema);
      if (updateResult.isErr()) {
        await this.deleteBackup(backupKey); // Clean up backup
        return Err(updateResult.unwrapErr());
      }

      const updatedSchema = updateResult.unwrap();

      // Save updated data
      const saveResult = await this.save(updatedSchema);
      if (saveResult.isErr()) {
        // Attempt rollback
        const rollbackResult = await this.restoreFromBackup(backupKey);
        await this.deleteBackup(backupKey); // Clean up backup

        if (rollbackResult.isErr()) {
          return Err(
            `Failed to save updated data: ${saveResult.unwrapErr()}, and rollback also failed: ${rollbackResult.unwrapErr()}`
          );
        }

        return Err(
          `Failed to save updated data: ${saveResult.unwrapErr()}, but rollback was successful`
        );
      }

      // Clean up backup after successful update
      await this.deleteBackup(backupKey);
      return Ok(undefined);
    } catch (error) {
      // Attempt rollback on any unexpected error
      try {
        await this.restoreFromBackup(backupKey);
      } catch {
        // Ignore rollback errors in this case
      }
      await this.deleteBackup(backupKey);
      return Err(
        `Atomic update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private calculateCurrentUsage(): number {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return 0;
    }

    let totalSize = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            // Account for both key and value size
            totalSize += key.length + value.length;
          }
        }
      }
    } catch {
      // If we can't calculate, return 0
      return 0;
    }

    return totalSize;
  }
}
