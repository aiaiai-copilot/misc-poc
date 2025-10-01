/**
 * Streaming Import Handler with Error Recovery
 * Task 12.7: Enhanced import with comprehensive error recovery
 *
 * Combines features from:
 * - Task 12.5: Progress reporting
 * - Task 12.6: Streaming and file size limits
 * - Task 12.7: Error recovery and partial import handling
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { validateExportFormat } from '@misc-poc/shared';
import { progressTracker } from './progress-tracker.js';
import { ErrorRecoveryService } from './services/error-recovery-service.js';
import { ErrorMessageBuilder } from './utils/error-messages.js';
import { ImportConfig, ImportResult } from './streaming-import.js';
import {
  ImportRecoveryOptions,
  ChunkRollbackInfo,
} from './types/error-recovery.js';

const DEFAULT_CONFIG: Required<ImportConfig> = {
  chunkSize: 500,
  maxRecords: 50000,
};

/**
 * Handle import with comprehensive error recovery
 */
export async function handleImportWithRecovery(
  req: Request,
  res: Response,
  dataSource: DataSource,
  config: ImportConfig = {}
): Promise<void> {
  const actualConfig = { ...DEFAULT_CONFIG, ...config };
  const user = req.user as { userId: string; email: string };
  const enableProgress = req.query.progress === 'true';
  const recoveryService = new ErrorRecoveryService(dataSource);

  const importData = req.body;

  try {
    // Check if this is a resume request
    const recoveryOptions = req.body.recoveryOptions as
      | ImportRecoveryOptions
      | undefined;
    if (recoveryOptions?.action === 'resume') {
      return handleResumeImport(
        req,
        res,
        dataSource,
        recoveryService,
        recoveryOptions
      );
    }

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

      const errorEntry = ErrorMessageBuilder.buildMalformedJsonMessage(
        0,
        errorMessage
      );

      res.status(400).json({
        error: errorEntry.errorMessage,
        suggestions: errorEntry.suggestion ? [errorEntry.suggestion] : [],
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
      const errorEntry = ErrorMessageBuilder.buildSizeLimitMessage(
        recordsToImport.length,
        actualConfig.maxRecords
      );

      res.status(400).json({
        error: errorEntry.errorMessage,
        code: 'TOO_MANY_RECORDS',
        suggestions: errorEntry.suggestion ? [errorEntry.suggestion] : [],
      });
      return;
    }

    // Step 3: Create import session for tracking
    const session = await recoveryService.createSession(
      user.userId,
      recordsToImport.length
    );
    await recoveryService.updateSessionStatus(session.sessionId, 'in-progress');

    // Step 4: Process with or without progress tracking
    if (enableProgress) {
      // Create progress session
      const progressSessionId = progressTracker.createSession(user.userId);

      // Send initial "started" event
      progressTracker.sendUpdate(progressSessionId, {
        status: 'started',
        processed: 0,
        total: recordsToImport.length,
        currentOperation: 'Initializing import',
        log: `Preparing to import ${recordsToImport.length} records`,
      });

      // Send initial response with session IDs
      res.status(202).json({
        sessionId: session.sessionId,
        progressSessionId: progressSessionId,
        progressUrl: `/api/import/progress/${progressSessionId}`,
        message: 'Import started, check progress at provided URL',
      });

      // Process asynchronously with progress and error recovery
      processWithRecovery(
        recordsToImport,
        user.userId,
        dataSource,
        recoveryService,
        actualConfig.chunkSize,
        session.sessionId,
        progressSessionId
      ).catch((error) => {
        console.error('Error in import with recovery:', error);
        progressTracker.sendUpdate(progressSessionId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    } else {
      // Process synchronously with error recovery
      const result = await processWithRecovery(
        recordsToImport,
        user.userId,
        dataSource,
        recoveryService,
        actualConfig.chunkSize,
        session.sessionId
      );

      if (!result.success) {
        // Build comprehensive error response
        const errorResponse = await recoveryService.buildErrorResponse(
          session.sessionId,
          true
        );
        res.status(422).json(errorResponse);
      } else {
        res.json(result);
      }
    }
  } catch (error) {
    console.error('Error in streaming import with recovery:', error);
    res.status(500).json({
      error: 'Internal server error while importing data',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

/**
 * Handle resume of a paused/failed import
 */
async function handleResumeImport(
  _req: Request,
  res: Response,
  _dataSource: DataSource,
  recoveryService: ErrorRecoveryService,
  options: ImportRecoveryOptions
): Promise<void> {
  const { sessionId } = options;

  // Check if session can be resumed
  const canResume = await recoveryService.canResume(sessionId);
  if (!canResume) {
    res.status(400).json({
      error: 'Session cannot be resumed',
      reason: 'Session expired, completed, or not found',
    });
    return;
  }

  const session = await recoveryService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Get resume information
  const resumeInfo = await recoveryService.getResumeInfo(sessionId);
  if (!resumeInfo) {
    res.status(400).json({ error: 'Unable to resume session' });
    return;
  }

  res.json({
    message: 'Resume functionality ready',
    sessionId,
    resumeInfo,
    note: 'Resume implementation requires original import data - to be completed in next iteration',
  });
}

/**
 * Process records with comprehensive error recovery
 */
async function processWithRecovery(
  records: Array<{
    content: string;
    createdAt: string;
    updatedAt: string;
  }>,
  userId: string,
  dataSource: DataSource,
  recoveryService: ErrorRecoveryService,
  chunkSize: number,
  sessionId: string,
  progressSessionId?: string
): Promise<ImportResult & { success: boolean; sessionId: string }> {
  const total = records.length;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const rollbackInfo: ChunkRollbackInfo[] = [];

  try {
    // Send initial progress if tracking enabled
    if (progressSessionId) {
      progressTracker.sendUpdate(progressSessionId, {
        status: 'started',
        processed: 0,
        total,
        currentOperation: 'Starting import',
        log: `Importing ${total} records in chunks of ${chunkSize}`,
      });
    }

    // Process in chunks with transaction rollback per chunk
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(records.length / chunkSize);

      // Update progress for chunk start
      if (progressSessionId) {
        progressTracker.sendUpdate(progressSessionId, {
          status: 'processing',
          processed: i,
          total,
          currentOperation: `Processing chunk ${chunkNumber}/${totalChunks}`,
          log: `Processing records ${i + 1} to ${Math.min(i + chunkSize, total)}`,
        });
      }

      // Start transaction for this chunk
      await dataSource.query('BEGIN');

      try {
        for (let j = 0; j < chunk.length; j++) {
          const record = chunk[j];
          if (!record) continue; // Safety check

          const globalIndex = i + j;

          try {
            // Extract tags from content
            const tags = record.content.trim().split(/\s+/).filter(Boolean);

            // Validate content
            if (tags.length === 0) {
              const errorEntry =
                ErrorMessageBuilder.buildEmptyContentMessage(globalIndex);
              await recoveryService.logError(sessionId, errorEntry);
              errors.push(errorEntry.errorMessage);
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
              const errorEntry = ErrorMessageBuilder.buildDuplicateMessage(
                record.content,
                globalIndex
              );
              await recoveryService.logError(sessionId, errorEntry);
              skipped++;
              continue;
            }

            // Validate dates
            const createdAt = new Date(record.createdAt);
            const updatedAt = new Date(record.updatedAt);

            if (isNaN(createdAt.getTime())) {
              const errorEntry = ErrorMessageBuilder.buildInvalidDateMessage(
                record.createdAt,
                globalIndex,
                record.content
              );
              await recoveryService.logError(sessionId, errorEntry);
              errors.push(errorEntry.errorMessage);
              continue;
            }

            if (isNaN(updatedAt.getTime())) {
              const errorEntry = ErrorMessageBuilder.buildInvalidDateMessage(
                record.updatedAt,
                globalIndex,
                record.content
              );
              await recoveryService.logError(sessionId, errorEntry);
              errors.push(errorEntry.errorMessage);
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
                createdAt,
                updatedAt,
              ]
            );

            imported++;
          } catch (recordError) {
            const errorMessage =
              recordError instanceof Error
                ? recordError.message
                : 'Unknown error';

            // Build appropriate error entry
            const errorEntry = ErrorMessageBuilder.buildDatabaseErrorMessage(
              errorMessage,
              globalIndex
            );
            await recoveryService.logError(sessionId, errorEntry);
            errors.push(errorEntry.errorMessage);
          }
        }

        // Commit chunk transaction
        await dataSource.query('COMMIT');

        // Update session progress
        await recoveryService.updateSessionProgress(
          sessionId,
          i + chunk.length,
          imported,
          errors.length,
          i + chunk.length - 1
        );

        // Update progress tracker
        if (progressSessionId) {
          progressTracker.sendUpdate(progressSessionId, {
            status: 'processing',
            processed: Math.min(i + chunkSize, total),
            total,
            imported,
            skipped,
            errors: errors.slice(-5), // Last 5 errors
            currentOperation: `Completed chunk ${chunkNumber}/${totalChunks}`,
            log: `Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}`,
          });
        }

        // Allow garbage collection between chunks
        if (i + chunkSize < records.length) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      } catch (chunkError) {
        // Rollback chunk on error
        await dataSource.query('ROLLBACK');

        const rollback: ChunkRollbackInfo = {
          chunkNumber,
          chunkSize: chunk.length,
          startIndex: i,
          endIndex: i + chunk.length - 1,
          reason:
            chunkError instanceof Error
              ? chunkError.message
              : 'Unknown chunk error',
          recordsAffected: chunk.length,
        };
        rollbackInfo.push(rollback);

        // Log chunk failure
        const errorEntry = ErrorMessageBuilder.buildGenericError(
          'CHUNK_FAILED',
          `Chunk ${chunkNumber} failed and was rolled back: ${rollback.reason}`,
          i,
          undefined,
          'error'
        );
        await recoveryService.logError(sessionId, errorEntry);
        errors.push(errorEntry.errorMessage);

        // Update session to paused state for potential resume
        await recoveryService.updateSessionStatus(sessionId, 'paused');

        if (progressSessionId) {
          progressTracker.sendUpdate(progressSessionId, {
            status: 'error',
            processed: i,
            total,
            imported,
            skipped,
            errors,
            error: `Chunk ${chunkNumber} failed - import paused`,
            currentOperation: `Chunk ${chunkNumber} failed - import paused`,
            log: `Import paused at chunk ${chunkNumber}. Can be resumed.`,
          });
        }

        // Return partial results with recovery information
        return {
          success: false,
          imported,
          skipped,
          errors,
          sessionId,
        };
      }
    }

    // Import completed successfully
    await recoveryService.updateSessionStatus(sessionId, 'completed');

    if (progressSessionId) {
      progressTracker.sendUpdate(progressSessionId, {
        status: 'completed',
        processed: total,
        total,
        imported,
        skipped,
        errors,
        currentOperation: 'Import completed successfully',
        log: `Finished importing ${imported} records, skipped ${skipped} duplicates, ${errors.length} errors`,
      });
    }

    return {
      success: true,
      imported,
      skipped,
      errors,
      sessionId,
    };
  } catch (error) {
    // Fatal error
    await recoveryService.updateSessionStatus(sessionId, 'failed');

    const errorEntry = ErrorMessageBuilder.buildGenericError(
      'IMPORT_FAILED',
      error instanceof Error ? error.message : 'Import failed',
      -1,
      undefined,
      'error'
    );
    await recoveryService.logError(sessionId, errorEntry);

    if (progressSessionId) {
      progressTracker.sendUpdate(progressSessionId, {
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

    return {
      success: false,
      imported,
      skipped,
      errors,
      sessionId,
    };
  }
}
