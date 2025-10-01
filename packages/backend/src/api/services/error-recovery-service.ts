/**
 * Error Recovery Service
 * Task 12.7: Service for managing import error recovery and partial imports
 */

import { DataSource } from 'typeorm';
import {
  ImportSession,
  ImportSessionStatus,
  ErrorLogEntry,
  ErrorSummary,
  RepairSuggestion,
  ImportErrorResponse,
  ResumeInfo,
} from '../types/error-recovery.js';

export class ErrorRecoveryService {
  private readonly MAX_ERROR_LOG_SIZE = 1000;
  private readonly SESSION_EXPIRY_HOURS = 24;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Create new import session for tracking progress
   */
  async createSession(
    userId: string,
    totalRecords: number
  ): Promise<ImportSession> {
    const sessionId = this.generateSessionId();

    const result = await this.dataSource.query(
      `
      INSERT INTO import_sessions
        (user_id, session_id, status, total_records, error_log)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [userId, sessionId, 'initializing', totalRecords, JSON.stringify([])]
    );

    return this.mapToSession(result[0]);
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(
    sessionId: string,
    processed: number,
    imported: number,
    failed: number,
    lastIndex: number
  ): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE import_sessions
      SET
        processed_records = $1,
        imported_records = $2,
        failed_records = $3,
        last_processed_index = $4,
        updated_at = NOW()
      WHERE session_id = $5
    `,
      [processed, imported, failed, lastIndex, sessionId]
    );
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: ImportSessionStatus
  ): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE import_sessions
      SET status = $1, updated_at = NOW()
      WHERE session_id = $2
    `,
      [status, sessionId]
    );
  }

  /**
   * Add error to session log
   */
  async logError(sessionId: string, error: ErrorLogEntry): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const errorLog = [...session.errorLog, error];

    // Limit error log size
    const trimmedLog =
      errorLog.length > this.MAX_ERROR_LOG_SIZE
        ? errorLog.slice(-this.MAX_ERROR_LOG_SIZE)
        : errorLog;

    await this.dataSource.query(
      `
      UPDATE import_sessions
      SET error_log = $1, updated_at = NOW()
      WHERE session_id = $2
    `,
      [JSON.stringify(trimmedLog), sessionId]
    );
  }

  /**
   * Get import session by ID
   */
  async getSession(sessionId: string): Promise<ImportSession | null> {
    const result = await this.dataSource.query(
      `
      SELECT * FROM import_sessions
      WHERE session_id = $1
    `,
      [sessionId]
    );

    return result.length > 0 ? this.mapToSession(result[0]) : null;
  }

  /**
   * Check if session can be resumed
   */
  async canResume(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Can resume if status is 'paused' or 'failed' and not expired
    const isExpired = this.isSessionExpired(session.createdAt);
    const canResumeStatus = ['paused', 'failed'].includes(session.status);

    return canResumeStatus && !isExpired;
  }

  /**
   * Get resume information for a session
   */
  async getResumeInfo(sessionId: string): Promise<ResumeInfo | null> {
    const session = await this.getSession(sessionId);
    if (!session || !(await this.canResume(sessionId))) {
      return null;
    }

    const lastIndex = session.lastProcessedIndex ?? -1;
    const remaining = session.totalRecords - session.processedRecords;

    return {
      sessionId: session.sessionId,
      lastProcessedIndex: lastIndex,
      remainingRecords: remaining,
      estimatedTime: this.estimateRemainingTime(remaining),
    };
  }

  /**
   * Generate error summary from session
   */
  async getErrorSummary(sessionId: string): Promise<ErrorSummary> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };
    const affectedRecords: number[] = [];

    for (const error of session.errorLog) {
      // Count by type
      errorsByType[error.errorCode] = (errorsByType[error.errorCode] || 0) + 1;

      // Count by severity
      errorsBySeverity[error.severity] =
        (errorsBySeverity[error.severity] || 0) + 1;

      // Track affected records
      if (!affectedRecords.includes(error.recordIndex)) {
        affectedRecords.push(error.recordIndex);
      }
    }

    return {
      totalErrors: session.errorLog.length,
      errorsByType,
      errorsBySeverity,
      affectedRecords: affectedRecords.sort((a, b) => a - b),
      successfulRecords: session.importedRecords,
      failedRecords: session.failedRecords,
    };
  }

  /**
   * Generate repair suggestions based on errors
   */
  generateRepairSuggestions(errors: ErrorLogEntry[]): RepairSuggestion[] {
    const suggestions: RepairSuggestion[] = [];
    const errorCodes = new Set(errors.map((e) => e.errorCode));

    // Duplicate record suggestions
    if (errorCodes.has('DUPLICATE_RECORD')) {
      suggestions.push({
        type: 'duplicate_update',
        message:
          'Some records already exist in the database. Consider using the update endpoint to modify existing records instead.',
        action: 'Remove duplicate records from import file or use update API',
      });
    }

    // Date format suggestions
    if (errorCodes.has('INVALID_DATE_FORMAT')) {
      suggestions.push({
        type: 'date_format',
        message: 'Invalid date format detected.',
        example: '2024-01-15T10:30:00.000Z',
        action: 'Convert dates to ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      });
    }

    // Empty content suggestions
    if (errorCodes.has('EMPTY_CONTENT')) {
      const emptyIndices = errors
        .filter((e) => e.errorCode === 'EMPTY_CONTENT')
        .map((e) => e.recordIndex);

      suggestions.push({
        type: 'remove_empty',
        message: `Found ${emptyIndices.length} record(s) with empty content.`,
        action: `Remove records at indices: ${emptyIndices.slice(0, 10).join(', ')}${emptyIndices.length > 10 ? '...' : ''}`,
      });
    }

    // Size limit suggestions
    if (errorCodes.has('TOO_MANY_RECORDS')) {
      suggestions.push({
        type: 'split_batch',
        message: 'Import file exceeds maximum size limit.',
        action: 'Split your import file into smaller batches of 10,000 records',
      });
    }

    // Special characters suggestions
    if (errorCodes.has('INVALID_CHARACTERS')) {
      suggestions.push({
        type: 'normalize_content',
        message: 'Special or invalid characters detected in record content.',
        action: 'Remove or escape special characters before importing',
      });
    }

    // Database errors - suggest retry
    if (
      errorCodes.has('DATABASE_ERROR') ||
      errorCodes.has('CONNECTION_ERROR')
    ) {
      suggestions.push({
        type: 'retry',
        message: 'Temporary database connection issue detected.',
        action:
          'Wait a few moments and retry the import using the resume feature',
      });
    }

    return suggestions;
  }

  /**
   * Build comprehensive error response
   */
  async buildErrorResponse(
    sessionId: string,
    includeResume: boolean = true
  ): Promise<ImportErrorResponse> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const errorSummary = await this.getErrorSummary(sessionId);
    const repairSuggestions = this.generateRepairSuggestions(session.errorLog);
    const canResume = await this.canResume(sessionId);
    const resumeInfo = includeResume
      ? await this.getResumeInfo(sessionId)
      : undefined;

    return {
      success: false,
      sessionId: session.sessionId,
      canResume,
      errorSummary,
      errors: session.errorLog,
      repairSuggestions,
      resumeInfo: resumeInfo ?? undefined,
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - this.SESSION_EXPIRY_HOURS);

    const result = await this.dataSource.query(
      `
      DELETE FROM import_sessions
      WHERE created_at < $1
      RETURNING id
    `,
      [expiryDate]
    );

    return result.length;
  }

  /**
   * Cancel an import session
   */
  async cancelSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'cancelled');
  }

  // Private helper methods

  private generateSessionId(): string {
    return `import-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private mapToSession(row: Record<string, unknown>): ImportSession {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      status: row.status as ImportSessionStatus,
      totalRecords: parseInt(row.total_records as string, 10),
      processedRecords: parseInt((row.processed_records as string) || '0', 10),
      importedRecords: parseInt((row.imported_records as string) || '0', 10),
      failedRecords: parseInt((row.failed_records as string) || '0', 10),
      lastProcessedIndex: row.last_processed_index
        ? parseInt(row.last_processed_index as string, 10)
        : null,
      errorLog: this.parseErrorLog(row.error_log),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private parseErrorLog(errorLogJson: unknown): ErrorLogEntry[] {
    try {
      if (typeof errorLogJson === 'string') {
        return JSON.parse(errorLogJson) as ErrorLogEntry[];
      }
      if (Array.isArray(errorLogJson)) {
        return errorLogJson as ErrorLogEntry[];
      }
      return [];
    } catch {
      return [];
    }
  }

  private isSessionExpired(createdAt: Date): boolean {
    const now = new Date();
    const expiryTime = new Date(createdAt);
    expiryTime.setHours(expiryTime.getHours() + this.SESSION_EXPIRY_HOURS);
    return now > expiryTime;
  }

  private estimateRemainingTime(remainingRecords: number): number {
    // Estimate ~100 records per second processing
    const recordsPerSecond = 100;
    return Math.ceil(remainingRecords / recordsPerSecond);
  }
}
