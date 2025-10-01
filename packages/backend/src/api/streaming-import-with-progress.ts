/**
 * Streaming Import Handler with Progress Tracking
 * Task 12.5: Progress reporting for large dataset imports
 *
 * Extended version of streaming-import.ts with real-time progress updates
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { validateExportFormat } from '@misc-poc/shared';
import { progressTracker } from './progress-tracker.js';
import { ImportConfig, ImportResult } from './streaming-import.js';

const DEFAULT_CONFIG: Required<ImportConfig> = {
  chunkSize: 500,
  maxRecords: 50000,
};

/**
 * Handle import with optional progress tracking
 */
export async function handleImportWithProgress(
  req: Request,
  res: Response,
  dataSource: DataSource,
  config: ImportConfig = {}
): Promise<void> {
  const actualConfig = { ...DEFAULT_CONFIG, ...config };
  const user = req.user as { userId: string; email: string };
  const enableProgress = req.query.progress === 'true';

  const importData = req.body;

  try {
    // Step 1: Validate JSON structure
    const validationResult = validateExportFormat(importData);
    if (!validationResult.success) {
      const zodError = validationResult.error;
      let errorMessage = 'Invalid import data format';

      try {
        const issues = (
          zodError as {
            issues?: Array<{
              path: (string | number)[];
              message: string;
            }>;
          }
        ).issues;

        if (issues && Array.isArray(issues)) {
          errorMessage = issues
            .map((err: { path: (string | number)[]; message: string }) => {
              const path =
                err.path && err.path.length > 0 ? err.path.join('.') : 'root';
              return `${path}: ${err.message}`;
            })
            .join('; ');
        } else if (zodError && zodError.message) {
          errorMessage = zodError.message;
        }
      } catch (err) {
        console.error('Error formatting validation error:', err);
      }

      res.status(400).json({
        error: `Import data validation failed: ${errorMessage}`,
      });
      return;
    }

    const validatedData = validationResult.data;

    // Step 2: Transform v1.0 to v2.0 format if needed
    let recordsToImport: Array<{
      content: string;
      createdAt: string;
      updatedAt: string;
    }>;

    if (validatedData.version === '1.0') {
      recordsToImport = validatedData.records.map((record) => ({
        content: record.content,
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      }));
    } else {
      recordsToImport = validatedData.records;
    }

    // Check maximum records limit
    if (recordsToImport.length > actualConfig.maxRecords) {
      res.status(400).json({
        error: `Too many records. Maximum ${actualConfig.maxRecords} records allowed per import. Received: ${recordsToImport.length}`,
        code: 'TOO_MANY_RECORDS',
      });
      return;
    }

    // Step 3: Process with or without progress tracking
    if (enableProgress) {
      // Create progress session
      const sessionId = progressTracker.createSession(user.userId);

      // Send initial "started" event IMMEDIATELY so SSE clients can connect
      progressTracker.sendUpdate(sessionId, {
        status: 'started',
        processed: 0,
        total: recordsToImport.length,
        currentOperation: 'Initializing import',
        log: `Preparing to import ${recordsToImport.length} records`,
      });

      // Send initial response with session ID
      res.status(202).json({
        sessionId,
        progressUrl: `/api/import/progress/${sessionId}`,
        message: 'Import started, check progress at provided URL',
      });

      // Process asynchronously with progress updates
      processWithProgress(
        recordsToImport,
        user.userId,
        dataSource,
        actualConfig.chunkSize,
        sessionId
      ).catch((error) => {
        console.error('Error in import with progress:', error);
        progressTracker.sendUpdate(sessionId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    } else {
      // Process synchronously without progress (backward compatibility)
      const result = await processRecordsInChunks(
        recordsToImport,
        user.userId,
        dataSource,
        actualConfig.chunkSize
      );

      res.json(result);
    }
  } catch (error) {
    console.error('Error in streaming import:', error);
    res.status(500).json({
      error: 'Internal server error while importing data',
    });
  }
}

/**
 * Process records with progress tracking
 */
async function processWithProgress(
  records: Array<{
    content: string;
    createdAt: string;
    updatedAt: string;
  }>,
  userId: string,
  dataSource: DataSource,
  chunkSize: number,
  sessionId: string
): Promise<void> {
  const total = records.length;

  // Send initial progress
  progressTracker.sendUpdate(sessionId, {
    status: 'started',
    processed: 0,
    total,
    currentOperation: 'Starting import',
    log: `Importing ${total} records in chunks of ${chunkSize}`,
  });

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Process in chunks
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(records.length / chunkSize);

      // Update progress for chunk start
      progressTracker.sendUpdate(sessionId, {
        status: 'processing',
        processed: i,
        total,
        currentOperation: `Processing chunk ${chunkNumber}/${totalChunks}`,
        log: `Processing records ${i + 1} to ${Math.min(i + chunkSize, total)}`,
      });

      await dataSource.query('BEGIN');

      try {
        for (const record of chunk) {
          try {
            // Extract tags from content
            const tags = record.content.trim().split(/\s+/).filter(Boolean);

            // Skip empty content
            if (tags.length === 0) {
              errors.push(
                `Record with empty content skipped: "${record.content}"`
              );
              continue;
            }

            // Normalize tags
            const normalizedTags = tags.map((tag) => tag.toLowerCase());

            // Check for duplicate
            const duplicateCheck = await dataSource.query(
              `
              SELECT id FROM records
              WHERE user_id = $1 AND normalized_tags = $2
            `,
              [userId, normalizedTags]
            );

            if (duplicateCheck.length > 0) {
              skipped++;
              continue;
            }

            // Insert new record
            await dataSource.query(
              `
              INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
              [
                userId,
                record.content,
                tags,
                normalizedTags,
                record.createdAt,
                record.updatedAt,
              ]
            );

            imported++;
          } catch (recordError) {
            const errorMessage =
              recordError instanceof Error
                ? recordError.message
                : 'Unknown error';
            errors.push(`Record "${record.content}": ${errorMessage}`);
          }
        }

        await dataSource.query('COMMIT');

        // Update progress after chunk completion
        progressTracker.sendUpdate(sessionId, {
          status: 'processing',
          processed: Math.min(i + chunkSize, total),
          total,
          imported,
          skipped,
          errors: errors.slice(-5), // Last 5 errors
          currentOperation: `Completed chunk ${chunkNumber}/${totalChunks}`,
          log: `Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}`,
        });

        // Allow garbage collection between chunks
        if (i + chunkSize < records.length) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      } catch (chunkError) {
        await dataSource.query('ROLLBACK');
        throw chunkError;
      }
    }

    // Send completion
    progressTracker.sendUpdate(sessionId, {
      status: 'completed',
      processed: total,
      total,
      imported,
      skipped,
      errors,
      currentOperation: 'Import completed successfully',
      log: `Finished importing ${imported} records, skipped ${skipped} duplicates, ${errors.length} errors`,
    });
  } catch (error) {
    progressTracker.sendUpdate(sessionId, {
      status: 'error',
      processed: imported + skipped,
      total,
      imported,
      skipped,
      errors,
      error: error instanceof Error ? error.message : 'Unknown error',
      log: 'Import failed with error',
    });
  }
}

/**
 * Process records in chunks (without progress tracking - for backward compatibility)
 */
async function processRecordsInChunks(
  records: Array<{
    content: string;
    createdAt: string;
    updatedAt: string;
  }>,
  userId: string,
  dataSource: DataSource,
  chunkSize: number
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process in chunks
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);

    await dataSource.query('BEGIN');

    try {
      for (const record of chunk) {
        try {
          // Extract tags from content
          const tags = record.content.trim().split(/\s+/).filter(Boolean);

          // Skip empty content
          if (tags.length === 0) {
            continue;
          }

          // Normalize tags
          const normalizedTags = tags.map((tag) => tag.toLowerCase());

          // Check for duplicate
          const duplicateCheck = await dataSource.query(
            `
            SELECT id FROM records
            WHERE user_id = $1 AND normalized_tags = $2
          `,
            [userId, normalizedTags]
          );

          if (duplicateCheck.length > 0) {
            skipped++;
            continue;
          }

          // Insert new record
          await dataSource.query(
            `
            INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
            [
              userId,
              record.content,
              tags,
              normalizedTags,
              record.createdAt,
              record.updatedAt,
            ]
          );

          imported++;
        } catch (recordError) {
          const errorMessage =
            recordError instanceof Error
              ? recordError.message
              : 'Unknown error';
          errors.push(`Record "${record.content}": ${errorMessage}`);
        }
      }

      await dataSource.query('COMMIT');

      // Allow garbage collection between chunks
      if (i + chunkSize < records.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    } catch (chunkError) {
      await dataSource.query('ROLLBACK');
      throw chunkError;
    }
  }

  return {
    imported,
    skipped,
    errors,
  };
}
