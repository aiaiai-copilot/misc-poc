/**
 * Conflict Resolver Service
 * Task 12.4: Add Duplicate Detection and Conflict Resolution
 *
 * Resolves conflicts when duplicates are detected using strategies:
 * - Skip: Keep existing record, ignore incoming
 * - Overwrite: Replace existing with incoming
 * - Merge: Intelligently combine both records
 */

import { RecordDTO } from '../dtos/record-dto';
import { DuplicateMatch } from './duplicate-detector';

export type ConflictStrategy = 'skip' | 'overwrite' | 'merge';

export interface ConflictResolutionConfig {
  readonly strategy: ConflictStrategy;
  readonly mergeRules?: MergeRules;
  readonly reportDetails?: boolean;
}

export interface MergeRules {
  readonly preferNewer?: boolean; // Use newer timestamp
  readonly preferExisting?: boolean; // Keep existing data
  readonly combineTags?: boolean; // Merge tag sets
}

export interface ConflictResolutionResult {
  readonly action: 'skipped' | 'updated' | 'merged';
  readonly resolvedRecord: RecordDTO | null;
  readonly reason: string;
  readonly details: ConflictDetails;
}

export interface ConflictDetails {
  readonly existingRecord: RecordDTO;
  readonly incomingRecord: RecordDTO;
  readonly matchedBy: string[];
  readonly confidence: number;
  readonly changesApplied?: string[];
}

export class ConflictResolver {
  private readonly DEFAULT_CONFIG: ConflictResolutionConfig = {
    strategy: 'skip',
    mergeRules: {
      preferNewer: true,
      preferExisting: false,
      combineTags: true,
    },
    reportDetails: true,
  };

  /**
   * Resolve a single conflict
   */
  resolve(
    match: DuplicateMatch,
    config?: ConflictResolutionConfig
  ): ConflictResolutionResult {
    const effectiveConfig = { ...this.DEFAULT_CONFIG, ...config };
    const strategy = this.validateStrategy(effectiveConfig.strategy);

    switch (strategy) {
      case 'skip':
        return this.resolveSkip(match, effectiveConfig);
      case 'overwrite':
        return this.resolveOverwrite(match, effectiveConfig);
      case 'merge':
        return this.resolveMerge(match, effectiveConfig);
      default:
        return this.resolveSkip(match, effectiveConfig);
    }
  }

  /**
   * Resolve multiple conflicts
   */
  resolveMultiple(
    matches: DuplicateMatch[],
    config?: ConflictResolutionConfig
  ): ConflictResolutionResult[] {
    return matches.map((match) => this.resolve(match, config));
  }

  /**
   * Skip strategy - ignore incoming record
   */
  private resolveSkip(
    match: DuplicateMatch,
    config: ConflictResolutionConfig
  ): ConflictResolutionResult {
    return {
      action: 'skipped',
      resolvedRecord: null,
      reason: `Record skipped due to duplicate detection (matched by ${match.matchedBy}, confidence: ${match.confidence}%)`,
      details: {
        existingRecord: match.existingRecord,
        incomingRecord: match.incomingRecord,
        matchedBy: [match.matchedBy],
        confidence: match.confidence,
        changesApplied: config.reportDetails ? [] : undefined,
      },
    };
  }

  /**
   * Overwrite strategy - replace existing with incoming
   */
  private resolveOverwrite(
    match: DuplicateMatch,
    config: ConflictResolutionConfig
  ): ConflictResolutionResult {
    const changesApplied: string[] = [];

    // Preserve existing ID
    const resolvedRecord: RecordDTO = {
      ...match.incomingRecord,
      id: match.existingRecord.id, // Keep existing ID
    };

    if (config.reportDetails) {
      if (match.existingRecord.content !== match.incomingRecord.content) {
        changesApplied.push('content');
      }
      if (
        JSON.stringify(match.existingRecord.tagIds) !==
        JSON.stringify(match.incomingRecord.tagIds)
      ) {
        changesApplied.push('tagIds');
      }
      if (match.existingRecord.createdAt !== match.incomingRecord.createdAt) {
        changesApplied.push('createdAt');
      }
      if (match.existingRecord.updatedAt !== match.incomingRecord.updatedAt) {
        changesApplied.push('updatedAt');
      }
    }

    return {
      action: 'updated',
      resolvedRecord,
      reason: `Record overwritten with incoming data (matched by ${match.matchedBy})`,
      details: {
        existingRecord: match.existingRecord,
        incomingRecord: match.incomingRecord,
        matchedBy: [match.matchedBy],
        confidence: match.confidence,
        changesApplied: config.reportDetails ? changesApplied : undefined,
      },
    };
  }

  /**
   * Merge strategy - intelligently combine records
   */
  private resolveMerge(
    match: DuplicateMatch,
    config: ConflictResolutionConfig
  ): ConflictResolutionResult {
    const mergeRules = {
      ...this.DEFAULT_CONFIG.mergeRules,
      ...config.mergeRules,
    };
    const changesApplied: string[] = [];

    // Merge content
    const mergedContent = this.mergeContent(
      match.existingRecord.content,
      match.incomingRecord.content,
      mergeRules
    );
    if (mergedContent !== match.existingRecord.content) {
      changesApplied.push('content');
    }

    // Merge tags
    let mergedTags = match.existingRecord.tagIds;
    if (mergeRules.combineTags) {
      mergedTags = this.mergeTags(
        match.existingRecord.tagIds,
        match.incomingRecord.tagIds
      );
      if (
        JSON.stringify(mergedTags) !==
        JSON.stringify(match.existingRecord.tagIds)
      ) {
        changesApplied.push('tagIds');
      }
    }

    // Merge timestamps
    const timestamps = this.mergeTimestamps(
      match.existingRecord,
      match.incomingRecord,
      mergeRules
    );
    if (timestamps.createdAt !== match.existingRecord.createdAt) {
      changesApplied.push('createdAt');
    }
    if (timestamps.updatedAt !== match.existingRecord.updatedAt) {
      changesApplied.push('updatedAt');
    }

    // Create resolved record with all merged values
    const resolvedRecord: RecordDTO = {
      ...match.existingRecord,
      content: mergedContent,
      tagIds: mergedTags,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };

    return {
      action: 'merged',
      resolvedRecord,
      reason: `Records merged using ${mergeRules.preferNewer ? 'newer' : 'existing'} preference (matched by ${match.matchedBy})`,
      details: {
        existingRecord: match.existingRecord,
        incomingRecord: match.incomingRecord,
        matchedBy: [match.matchedBy],
        confidence: match.confidence,
        changesApplied: config.reportDetails ? changesApplied : undefined,
      },
    };
  }

  /**
   * Merge content intelligently
   */
  private mergeContent(
    existingContent: string,
    incomingContent: string,
    rules: MergeRules
  ): string {
    // If prefer existing, keep existing
    if (rules.preferExisting) {
      return existingContent;
    }

    // If prefer newer, use incoming (assuming incoming is newer)
    if (rules.preferNewer) {
      return incomingContent;
    }

    // Otherwise, combine unique words
    const existingWords = new Set(existingContent.split(/\s+/));
    const incomingWords = incomingContent.split(/\s+/);

    incomingWords.forEach((word) => existingWords.add(word));

    return Array.from(existingWords).join(' ');
  }

  /**
   * Merge tag arrays
   */
  private mergeTags(existingTags: string[], incomingTags: string[]): string[] {
    // Create union of tags, preserving existing order
    const tagSet = new Set(existingTags);
    const result = [...existingTags];

    incomingTags.forEach((tag) => {
      if (!tagSet.has(tag)) {
        result.push(tag);
        tagSet.add(tag);
      }
    });

    return result;
  }

  /**
   * Merge timestamps
   */
  private mergeTimestamps(
    existing: RecordDTO,
    incoming: RecordDTO,
    rules: MergeRules
  ): { createdAt: string; updatedAt: string } {
    try {
      const existingCreated = new Date(existing.createdAt);
      const incomingCreated = new Date(incoming.createdAt);
      const existingUpdated = new Date(existing.updatedAt);
      const incomingUpdated = new Date(incoming.updatedAt);

      let createdAt = existing.createdAt;
      let updatedAt = existing.updatedAt;

      if (rules.preferNewer) {
        // Use newer timestamps
        if (incomingCreated > existingCreated) {
          createdAt = incoming.createdAt;
        }
        if (incomingUpdated > existingUpdated) {
          updatedAt = incoming.updatedAt;
        }
      } else if (!rules.preferExisting) {
        // Default: use older created, newer updated
        if (incomingCreated < existingCreated) {
          createdAt = incoming.createdAt;
        }
        if (incomingUpdated > existingUpdated) {
          updatedAt = incoming.updatedAt;
        }
      }

      return { createdAt, updatedAt };
    } catch {
      // Invalid timestamps, fallback to existing
      return {
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }
  }

  /**
   * Validate strategy
   */
  private validateStrategy(strategy: ConflictStrategy): ConflictStrategy {
    const validStrategies: ConflictStrategy[] = ['skip', 'overwrite', 'merge'];
    return validStrategies.includes(strategy) ? strategy : 'skip';
  }
}
