/**
 * Streaming Import Handler
 * Task 12.6: Streaming JSON parsing and chunked processing for large imports
 *
 * Uses stream-json for memory-efficient processing of large JSON payloads
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { chain } from 'stream-chain';
import { validateExportFormat } from '@misc-poc/shared';

export interface ImportConfig {
  chunkSize?: number;
  maxRecords?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const DEFAULT_CONFIG: Required<ImportConfig> = {
  chunkSize: 500, // Process 500 records at a time
  maxRecords: 50000, // Maximum 50k records per import
};

/**
 * Process import with streaming for large datasets
 */
export async function handleStreamingImport(
  req: Request,
  res: Response,
  dataSource: DataSource,
  config: ImportConfig = {}
): Promise<void> {
  const actualConfig = { ...DEFAULT_CONFIG, ...config };
  const user = req.user as { userId: string; email: string };

  // For requests with Content-Type application/json, body is already parsed by express.json()
  // We'll use the parsed body directly for imports
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

    // Step 3: Process records in chunks for memory efficiency
    const result = await processRecordsInChunks(
      recordsToImport,
      user.userId,
      dataSource,
      actualConfig.chunkSize
    );

    res.json(result);
  } catch (error) {
    console.error('Error in streaming import:', error);
    res.status(500).json({
      error: 'Internal server error while importing data',
    });
  }
}

/**
 * Process records in chunks to avoid memory exhaustion
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

/**
 * Stream-based import handler (for future use with multipart/form-data)
 * Currently not used but prepared for file upload scenarios
 */
export async function handleStreamingFileImport(
  stream: Readable,
  userId: string,
  dataSource: DataSource,
  config: ImportConfig = {}
): Promise<ImportResult> {
  const actualConfig = { ...DEFAULT_CONFIG, ...config };

  return new Promise((resolve, reject) => {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    let recordBuffer: Array<{
      content: string;
      createdAt: string;
      updatedAt: string;
    }> = [];

    const pipeline = chain([
      stream,
      parser({ jsonStreaming: true }),
      streamArray(),
    ]);

    pipeline.on('data', async (data: { value: unknown }) => {
      const record = data.value as {
        content: string;
        createdAt: string;
        updatedAt: string;
      };

      recordBuffer.push(record);

      // Process in chunks
      if (recordBuffer.length >= actualConfig.chunkSize) {
        pipeline.pause();

        try {
          const result = await processRecordsInChunks(
            recordBuffer,
            userId,
            dataSource,
            actualConfig.chunkSize
          );

          imported += result.imported;
          skipped += result.skipped;
          errors.push(...result.errors);

          recordBuffer = [];
          pipeline.resume();
        } catch (error) {
          pipeline.destroy();
          reject(error);
        }
      }
    });

    pipeline.on('end', async () => {
      try {
        // Process remaining records
        if (recordBuffer.length > 0) {
          const result = await processRecordsInChunks(
            recordBuffer,
            userId,
            dataSource,
            actualConfig.chunkSize
          );

          imported += result.imported;
          skipped += result.skipped;
          errors.push(...result.errors);
        }

        resolve({ imported, skipped, errors });
      } catch (error) {
        reject(error);
      }
    });

    pipeline.on('error', (error: Error) => {
      reject(error);
    });
  });
}
