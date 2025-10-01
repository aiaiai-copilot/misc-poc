/**
 * Streaming Export Handler with Progress Tracking
 * Task 12.5: Progress reporting for large dataset exports
 *
 * Provides real-time progress updates for export operations
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { progressTracker } from './progress-tracker.js';

export interface ExportConfig {
  chunkSize?: number;
}

const DEFAULT_CONFIG: Required<ExportConfig> = {
  chunkSize: 500, // Process 500 records at a time
};

/**
 * Handle export with optional progress tracking
 */
export async function handleExportWithProgress(
  req: Request,
  res: Response,
  dataSource: DataSource,
  config: ExportConfig = {}
): Promise<void> {
  const actualConfig = { ...DEFAULT_CONFIG, ...config };
  const user = req.user as { userId: string; email: string };
  const enableProgress = req.query.progress === 'true';

  try {
    // Initialize database connection if not already initialized
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    if (enableProgress) {
      // Create progress session
      const sessionId = progressTracker.createSession(user.userId);

      // Send initial "started" event IMMEDIATELY so SSE clients can connect
      progressTracker.sendUpdate(sessionId, {
        status: 'started',
        processed: 0,
        total: 0,
        currentOperation: 'Initializing export',
        log: 'Preparing to export records',
      });

      // Send initial response with session ID
      res.status(202).json({
        sessionId,
        progressUrl: `/api/export/progress/${sessionId}`,
        message: 'Export started, check progress at provided URL',
      });

      // Process asynchronously with progress updates
      processExportWithProgress(
        user.userId,
        dataSource,
        actualConfig.chunkSize,
        sessionId
      ).catch((error) => {
        console.error('Error in export with progress:', error);
        progressTracker.sendUpdate(sessionId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    } else {
      // Process synchronously without progress (backward compatibility)
      const exportData = await performExport(user.userId, dataSource);
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      error: 'Internal server error while exporting data',
    });
  }
}

/**
 * Process export with progress tracking
 */
async function processExportWithProgress(
  userId: string,
  dataSource: DataSource,
  chunkSize: number,
  sessionId: string
): Promise<void> {
  try {
    // Send initial progress
    progressTracker.sendUpdate(sessionId, {
      status: 'started',
      processed: 0,
      total: 0,
      currentOperation: 'Counting records',
      log: 'Counting total records to export',
    });

    // Count total records
    const countResult = await dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM records
      WHERE user_id = $1
    `,
      [userId]
    );

    const total = parseInt(countResult[0].count, 10);

    progressTracker.sendUpdate(sessionId, {
      status: 'processing',
      processed: 0,
      total,
      currentOperation: 'Fetching user settings',
      log: `Found ${total} records to export`,
    });

    // Query user settings for normalization rules
    const settingsResult = await dataSource.query(
      `
      SELECT case_sensitive, remove_accents
      FROM user_settings
      WHERE user_id = $1
    `,
      [userId]
    );

    // Use default settings if not found
    const normalizationRules =
      settingsResult.length > 0
        ? {
            caseSensitive: settingsResult[0].case_sensitive,
            removeAccents: settingsResult[0].remove_accents,
          }
        : {
            caseSensitive: false,
            removeAccents: true,
          };

    // Fetch records in chunks
    const exportRecords: Array<{
      content: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    const totalChunks = Math.ceil(total / chunkSize);

    for (let offset = 0; offset < total; offset += chunkSize) {
      const chunkNumber = Math.floor(offset / chunkSize) + 1;

      progressTracker.sendUpdate(sessionId, {
        status: 'processing',
        processed: offset,
        total,
        currentOperation: `Fetching chunk ${chunkNumber}/${totalChunks}`,
        log: `Fetching records ${offset + 1} to ${Math.min(offset + chunkSize, total)}`,
      });

      const records = await dataSource.query(
        `
        SELECT content, created_at, updated_at
        FROM records
        WHERE user_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `,
        [userId, chunkSize, offset]
      );

      // Transform records to export format
      const chunkRecords = records.map(
        (record: { content: string; created_at: Date; updated_at: Date }) => ({
          content: record.content,
          createdAt: record.created_at.toISOString(),
          updatedAt: record.updated_at.toISOString(),
        })
      );

      exportRecords.push(...chunkRecords);

      progressTracker.sendUpdate(sessionId, {
        status: 'processing',
        processed: Math.min(offset + chunkSize, total),
        total,
        currentOperation: `Processed chunk ${chunkNumber}/${totalChunks}`,
        log: `Fetched ${exportRecords.length} records so far`,
      });

      // Allow garbage collection between chunks
      if (offset + chunkSize < total) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Build export response in v2.0 format
    const exportData = {
      version: '2.0',
      records: exportRecords,
      metadata: {
        exportedAt: new Date().toISOString(),
        recordCount: exportRecords.length,
        normalizationRules,
      },
    };

    // Send completion with export data
    progressTracker.sendUpdate(sessionId, {
      status: 'completed',
      processed: total,
      total,
      exportData,
      currentOperation: 'Export completed successfully',
      log: `Exported ${exportRecords.length} records`,
    });
  } catch (error) {
    progressTracker.sendUpdate(sessionId, {
      status: 'error',
      processed: 0,
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      log: 'Export failed with error',
    });
  }
}

/**
 * Perform export without progress tracking (backward compatibility)
 */
async function performExport(
  userId: string,
  dataSource: DataSource
): Promise<{
  version: string;
  records: Array<{
    content: string;
    createdAt: string;
    updatedAt: string;
  }>;
  metadata: {
    exportedAt: string;
    recordCount: number;
    normalizationRules: {
      caseSensitive: boolean;
      removeAccents: boolean;
    };
  };
}> {
  // Query all user records
  const records = await dataSource.query(
    `
    SELECT content, created_at, updated_at
    FROM records
    WHERE user_id = $1
    ORDER BY created_at ASC
  `,
    [userId]
  );

  // Query user settings for normalization rules
  const settingsResult = await dataSource.query(
    `
    SELECT case_sensitive, remove_accents
    FROM user_settings
    WHERE user_id = $1
  `,
    [userId]
  );

  // Use default settings if not found
  const normalizationRules =
    settingsResult.length > 0
      ? {
          caseSensitive: settingsResult[0].case_sensitive,
          removeAccents: settingsResult[0].remove_accents,
        }
      : {
          caseSensitive: false,
          removeAccents: true,
        };

  // Transform records to export format
  const exportRecords = records.map(
    (record: { content: string; created_at: Date; updated_at: Date }) => ({
      content: record.content,
      createdAt: record.created_at.toISOString(),
      updatedAt: record.updated_at.toISOString(),
    })
  );

  // Build export response in v2.0 format
  return {
    version: '2.0',
    records: exportRecords,
    metadata: {
      exportedAt: new Date().toISOString(),
      recordCount: exportRecords.length,
      normalizationRules,
    },
  };
}
