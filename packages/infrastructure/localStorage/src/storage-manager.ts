import {
  StorageSchema,
  type StorageSchemaV21,
  type LegacyStorageSchemaV20,
} from './storage-schema';

export interface QuotaUsage {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

export interface PerformanceMetrics {
  lastSaveTime: number;
  averageSaveTime: number;
  totalOperations: number;
}

export interface BackupData {
  timestamp: string;
  data: StorageSchemaV21;
}

export class StorageManager {
  private readonly storageKey: string;
  private readonly backupKeyPrefix: string;
  private readonly maxBackups = 10;
  private performanceMetrics: PerformanceMetrics = {
    lastSaveTime: 0,
    averageSaveTime: 0,
    totalOperations: 0,
  };
  private readonly slowOperationThreshold = 1000; // 1 second
  private readonly quotaWarningThreshold = 80; // 80%
  private saveLock = false;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.backupKeyPrefix = `${storageKey}_backup_`;
  }

  async load(): Promise<StorageSchemaV21> {
    try {
      const startTime = performance.now();

      const jsonData = localStorage.getItem(this.storageKey);
      if (!jsonData) {
        return StorageSchema.createEmpty();
      }

      let parsedData: unknown;
      try {
        parsedData = JSON.parse(jsonData);
      } catch {
        console.warn(
          'Invalid JSON in localStorage, initializing with empty schema'
        );
        return StorageSchema.createEmpty();
      }

      // Handle migration from legacy schema
      if (StorageSchema.needsMigration(parsedData)) {
        if (this.isLegacySchema(parsedData)) {
          console.log('Migrating legacy storage schema from v2.0 to v2.1');
          const migratedSchema = StorageSchema.migrate(parsedData);
          await this.save(migratedSchema);
          return migratedSchema;
        } else {
          console.warn(
            'Unrecognized schema version, initializing with empty schema'
          );
          return StorageSchema.createEmpty();
        }
      }

      if (!StorageSchema.isValid(parsedData)) {
        console.warn(
          'Invalid schema structure, initializing with empty schema'
        );
        return StorageSchema.createEmpty();
      }

      const loadTime = performance.now() - startTime;
      this.updateMetrics(loadTime);

      return parsedData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load storage: ${error.message}`);
      }
      throw new Error('Failed to load storage: Unknown error');
    }
  }

  async save(schema: StorageSchemaV21): Promise<void> {
    if (this.saveLock) {
      throw new Error('Save operation already in progress');
    }

    this.saveLock = true;
    const startTime = performance.now();

    try {
      const jsonData = StorageSchema.toJSON(schema);

      // Check quota before saving
      await this.checkQuotaWarnings();

      localStorage.setItem(this.storageKey, jsonData);

      const saveTime = performance.now() - startTime;
      this.updateMetrics(saveTime);

      if (saveTime > this.slowOperationThreshold) {
        console.warn(
          `Slow storage operation detected: ${saveTime.toFixed(2)}ms`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.name === 'QuotaExceededError' ||
          error.message.includes('QuotaExceededError')
        ) {
          throw new Error('Storage quota exceeded');
        }

        if (error.name === 'SecurityError') {
          throw new Error(`Storage access denied: ${error.message}`);
        }

        throw new Error(`Storage save failed: ${error.message}`);
      }
      throw new Error('Storage save failed: Unknown error');
    } finally {
      this.saveLock = false;
    }
  }

  async getQuotaUsage(): Promise<QuotaUsage> {
    try {
      // Calculate current storage usage
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalSize += key.length + value.length;
        }
      }

      // Estimate total available storage (typically 5-10MB in most browsers)
      const estimatedTotal = 5 * 1024 * 1024; // 5MB
      const used = totalSize * 2; // UTF-16 encoding uses 2 bytes per character
      const available = Math.max(0, estimatedTotal - used);
      const percentage = Math.min(100, (used / estimatedTotal) * 100);

      return {
        used,
        available,
        total: estimatedTotal,
        percentage,
      };
    } catch {
      // Return default values if quota calculation fails
      return {
        used: 0,
        available: 5 * 1024 * 1024,
        total: 5 * 1024 * 1024,
        percentage: 0,
      };
    }
  }

  async verifyIntegrity(schema: StorageSchemaV21): Promise<boolean> {
    try {
      // Check basic schema validity
      if (!StorageSchema.isValid(schema)) {
        return false;
      }

      // Verify index consistency
      const { indexes, tags, records } = schema;

      // Check normalizedToTagId index
      for (const [normalized, tagId] of Object.entries(
        indexes.normalizedToTagId
      )) {
        const tag = tags[tagId];
        if (!tag || tag.normalizedValue !== normalized) {
          return false;
        }
      }

      // Check tagToRecords index
      for (const [tagId, recordIds] of Object.entries(indexes.tagToRecords)) {
        const tag = tags[tagId];
        if (!tag) {
          return false;
        }

        for (const recordId of recordIds) {
          const record = records[recordId];
          if (!record || !record.tagIds.includes(tagId)) {
            return false;
          }
        }
      }

      // Verify all records have valid tag references
      for (const record of Object.values(records)) {
        for (const tagId of record.tagIds) {
          if (!tags[tagId]) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async repairData(schema: StorageSchemaV21): Promise<StorageSchemaV21> {
    const repairedSchema: StorageSchemaV21 = {
      ...schema,
      indexes: {
        normalizedToTagId: {},
        tagToRecords: {},
      },
    };

    // Rebuild normalizedToTagId index
    for (const tag of Object.values(schema.tags)) {
      repairedSchema.indexes.normalizedToTagId[tag.normalizedValue] = tag.id;
    }

    // Rebuild tagToRecords index
    for (const record of Object.values(schema.records)) {
      for (const tagId of record.tagIds) {
        if (schema.tags[tagId]) {
          // Only include valid tags
          if (!repairedSchema.indexes.tagToRecords[tagId]) {
            repairedSchema.indexes.tagToRecords[tagId] = [];
          }
          repairedSchema.indexes.tagToRecords[tagId].push(record.id);
        }
      }
    }

    // Remove duplicate record IDs from indexes
    for (const tagId in repairedSchema.indexes.tagToRecords) {
      repairedSchema.indexes.tagToRecords[tagId] = [
        ...new Set(repairedSchema.indexes.tagToRecords[tagId]),
      ];
    }

    return repairedSchema;
  }

  async createBackup(): Promise<BackupData> {
    try {
      const currentData = await this.load();
      const backup: BackupData = {
        timestamp: new Date().toISOString(),
        data: currentData,
      };

      // Store backup
      const backupKey = `${this.backupKeyPrefix}${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(backup));

      // Clean up old backups (but don't clean up too aggressively during tests)
      await this.cleanupOldBackups();

      return backup;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create backup: ${error.message}`);
      }
      throw new Error('Failed to create backup: Unknown error');
    }
  }

  async restoreFromBackup(backup: BackupData): Promise<void> {
    try {
      // Validate backup data
      if (!backup.data || !StorageSchema.isValid(backup.data)) {
        throw new Error('Invalid backup data structure');
      }

      // Verify backup timestamp
      if (!backup.timestamp || isNaN(new Date(backup.timestamp).getTime())) {
        throw new Error('Invalid backup timestamp');
      }

      await this.save(backup.data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to restore backup: ${error.message}`);
      }
      throw new Error('Failed to restore backup: Unknown error');
    }
  }

  async getBackupHistory(): Promise<BackupData[]> {
    const backups: BackupData[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKeyPrefix)) {
          const backupJson = localStorage.getItem(key);
          if (backupJson) {
            try {
              const backup = JSON.parse(backupJson) as BackupData;
              backups.push(backup);
            } catch {
              // Skip invalid backup entries
              localStorage.removeItem(key);
            }
          }
        }
      }

      // Sort backups by timestamp (newest first)
      backups.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return backups.slice(0, this.maxBackups);
    } catch {
      return [];
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  private isLegacySchema(data: unknown): data is LegacyStorageSchemaV20 {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const schema = data as Record<string, unknown>;
    return (
      schema.version === '2.0' &&
      Array.isArray(schema.tags) &&
      Array.isArray(schema.records)
    );
  }

  private async checkQuotaWarnings(): Promise<void> {
    try {
      const usage = await this.getQuotaUsage();
      if (usage.percentage > this.quotaWarningThreshold) {
        console.warn(
          `Storage usage is high: ${usage.percentage.toFixed(1)}%. Consider cleaning up old data.`
        );
      }
    } catch {
      // Ignore quota check failures
    }
  }

  private updateMetrics(operationTime: number): void {
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.lastSaveTime = operationTime;

    // Calculate running average
    const previousAverage = this.performanceMetrics.averageSaveTime;
    const totalOps = this.performanceMetrics.totalOperations;
    this.performanceMetrics.averageSaveTime =
      (previousAverage * (totalOps - 1) + operationTime) / totalOps;
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      // Get ALL backups, not limited to maxBackups
      const allBackups: BackupData[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKeyPrefix)) {
          const backupJson = localStorage.getItem(key);
          if (backupJson) {
            try {
              const backup = JSON.parse(backupJson) as BackupData;
              allBackups.push(backup);
            } catch {
              // Remove invalid backup entries
              localStorage.removeItem(key);
            }
          }
        }
      }

      // Sort backups by timestamp (newest first)
      allBackups.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Remove excess backups (keep only maxBackups)
      if (allBackups.length > this.maxBackups) {
        const backupsToDelete = allBackups.slice(this.maxBackups);

        for (const backup of backupsToDelete) {
          // Find and remove the backup from localStorage
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.backupKeyPrefix)) {
              const storedBackup = localStorage.getItem(key);
              if (storedBackup) {
                try {
                  const parsedBackup = JSON.parse(storedBackup) as BackupData;
                  if (parsedBackup.timestamp === backup.timestamp) {
                    localStorage.removeItem(key);
                    break;
                  }
                } catch {
                  // Remove invalid backup entries
                  localStorage.removeItem(key);
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore cleanup failures
    }
  }
}
