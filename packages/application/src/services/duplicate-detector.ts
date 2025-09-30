/**
 * Duplicate Detector Service
 * Task 12.4: Add Duplicate Detection and Conflict Resolution
 *
 * Detects duplicate records using multiple criteria:
 * - Record ID matching
 * - Content hash comparison
 * - Timestamp proximity
 */

import { createHash } from 'crypto';
import { RecordDTO } from '../dtos/record-dto';

export interface DuplicateDetectionConfig {
  readonly compareBy: ('id' | 'content' | 'timestamp')[];
  readonly contentHashAlgorithm?: 'md5' | 'sha256';
  readonly timestampToleranceMs?: number;
  readonly caseInsensitive?: boolean;
  readonly normalizeWhitespace?: boolean;
}

export interface DuplicateMatch {
  readonly existingRecord: RecordDTO;
  readonly incomingRecord: RecordDTO;
  readonly matchedBy: 'id' | 'content' | 'timestamp';
  readonly confidence: number; // 0-100
}

export interface DuplicateDetectionResult {
  readonly isDuplicate: boolean;
  readonly matches: DuplicateMatch[];
  readonly confidence: number; // 0-100
}

export class DuplicateDetector {
  private readonly DEFAULT_CONFIG: DuplicateDetectionConfig = {
    compareBy: ['content', 'timestamp'],
    contentHashAlgorithm: 'md5',
    timestampToleranceMs: 5000, // 5 seconds
    caseInsensitive: false,
    normalizeWhitespace: true,
  };

  /**
   * Detect duplicates for an incoming record against existing records
   */
  detect(
    incomingRecord: RecordDTO,
    existingRecords: RecordDTO[],
    config?: DuplicateDetectionConfig
  ): DuplicateDetectionResult {
    const effectiveConfig = { ...this.DEFAULT_CONFIG, ...config };

    if (!existingRecords || existingRecords.length === 0) {
      return {
        isDuplicate: false,
        matches: [],
        confidence: 0,
      };
    }

    const matches: DuplicateMatch[] = [];

    for (const existingRecord of existingRecords) {
      const match = this.detectSingleMatch(
        incomingRecord,
        existingRecord,
        effectiveConfig
      );

      if (match) {
        matches.push(match);
      }
    }

    // Sort matches by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    const isDuplicate = matches.length > 0;
    const overallConfidence =
      matches.length > 0 && matches[0] ? matches[0].confidence : 0;

    return {
      isDuplicate,
      matches,
      confidence: overallConfidence,
    };
  }

  /**
   * Detect if a single record matches
   */
  private detectSingleMatch(
    incomingRecord: RecordDTO,
    existingRecord: RecordDTO,
    config: DuplicateDetectionConfig
  ): DuplicateMatch | null {
    const criteriaChecks = config.compareBy.map((criterion) => {
      switch (criterion) {
        case 'id':
          return this.matchById(incomingRecord, existingRecord);
        case 'content':
          return this.matchByContent(
            incomingRecord,
            existingRecord,
            config.contentHashAlgorithm || 'md5',
            config.caseInsensitive || false,
            config.normalizeWhitespace !== false
          );
        case 'timestamp':
          return this.matchByTimestamp(
            incomingRecord,
            existingRecord,
            config.timestampToleranceMs
          );
        default:
          return null;
      }
    });

    const matchedCriteria = criteriaChecks.filter((check) => check !== null);

    if (matchedCriteria.length === 0) {
      return null;
    }

    // Calculate confidence based on number of matched criteria
    const confidence = (matchedCriteria.length / config.compareBy.length) * 100;

    // Use the first matched criterion for matchedBy
    const primaryMatch = matchedCriteria[0]!;

    return {
      existingRecord,
      incomingRecord,
      matchedBy: primaryMatch,
      confidence,
    };
  }

  /**
   * Check if records match by ID
   */
  private matchById(incoming: RecordDTO, existing: RecordDTO): 'id' | null {
    if (!incoming.id || !existing.id) {
      return null;
    }

    return incoming.id === existing.id ? 'id' : null;
  }

  /**
   * Check if records match by content hash
   */
  private matchByContent(
    incoming: RecordDTO,
    existing: RecordDTO,
    algorithm: 'md5' | 'sha256',
    caseInsensitive: boolean,
    normalizeWhitespace: boolean
  ): 'content' | null {
    const incomingContent = this.normalizeContent(
      incoming.content,
      caseInsensitive,
      normalizeWhitespace
    );
    const existingContent = this.normalizeContent(
      existing.content,
      caseInsensitive,
      normalizeWhitespace
    );

    const incomingHash = this.generateContentHash(incomingContent, algorithm);
    const existingHash = this.generateContentHash(existingContent, algorithm);

    return incomingHash === existingHash ? 'content' : null;
  }

  /**
   * Normalize content for comparison
   */
  private normalizeContent(
    content: string,
    caseInsensitive: boolean,
    normalizeWhitespace: boolean
  ): string {
    let normalized = content;

    if (caseInsensitive) {
      normalized = normalized.toLowerCase();
    }

    if (normalizeWhitespace) {
      // Replace multiple spaces with single space and trim
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    return normalized;
  }

  /**
   * Check if records match by timestamp proximity
   */
  private matchByTimestamp(
    incoming: RecordDTO,
    existing: RecordDTO,
    toleranceMs: number = 5000
  ): 'timestamp' | null {
    try {
      const incomingCreatedAt = new Date(incoming.createdAt).getTime();
      const existingCreatedAt = new Date(existing.createdAt).getTime();

      const incomingUpdatedAt = new Date(incoming.updatedAt).getTime();
      const existingUpdatedAt = new Date(existing.updatedAt).getTime();

      // Check if either timestamp pair is within tolerance
      const createdAtMatch =
        Math.abs(incomingCreatedAt - existingCreatedAt) <= toleranceMs;
      const updatedAtMatch =
        Math.abs(incomingUpdatedAt - existingUpdatedAt) <= toleranceMs;

      return createdAtMatch || updatedAtMatch ? 'timestamp' : null;
    } catch {
      // Invalid timestamp format
      return null;
    }
  }

  /**
   * Generate content hash
   */
  generateContentHash(
    content: string,
    algorithm: 'md5' | 'sha256' = 'md5'
  ): string {
    return createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Compare timestamps with tolerance
   */
  compareTimestamps(
    timestamp1: string,
    timestamp2: string,
    toleranceMs: number = 5000
  ): boolean {
    try {
      const time1 = new Date(timestamp1).getTime();
      const time2 = new Date(timestamp2).getTime();

      return Math.abs(time1 - time2) <= toleranceMs;
    } catch {
      return false;
    }
  }
}
