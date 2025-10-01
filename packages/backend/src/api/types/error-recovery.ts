/**
 * Error Recovery Types
 * Task 12.7: Types for comprehensive error handling and recovery
 */

export interface ImportSession {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly status: ImportSessionStatus;
  readonly totalRecords: number;
  readonly processedRecords: number;
  readonly importedRecords: number;
  readonly failedRecords: number;
  readonly lastProcessedIndex: number | null;
  readonly errorLog: ErrorLogEntry[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ImportSessionStatus =
  | 'initializing'
  | 'in-progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ErrorLogEntry {
  readonly recordIndex: number;
  readonly recordContent?: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly timestamp: string;
  readonly chunkNumber?: number;
  readonly severity: ErrorSeverity;
  readonly suggestion?: RepairSuggestion;
}

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface RepairSuggestion {
  readonly type: RepairSuggestionType;
  readonly message: string;
  readonly example?: string;
  readonly action?: string;
}

export type RepairSuggestionType =
  | 'duplicate_update'
  | 'date_format'
  | 'remove_empty'
  | 'split_batch'
  | 'normalize_content'
  | 'retry'
  | 'contact_support';

export interface ImportErrorResponse {
  readonly success: false;
  readonly sessionId: string;
  readonly canResume: boolean;
  readonly errorSummary: ErrorSummary;
  readonly errors: ErrorLogEntry[];
  readonly repairSuggestions: RepairSuggestion[];
  readonly resumeInfo?: ResumeInfo;
}

export interface ErrorSummary {
  readonly totalErrors: number;
  readonly errorsByType: Record<string, number>;
  readonly errorsBySeverity: Record<ErrorSeverity, number>;
  readonly affectedRecords: number[];
  readonly successfulRecords: number;
  readonly failedRecords: number;
}

export interface ResumeInfo {
  readonly sessionId: string;
  readonly lastProcessedIndex: number;
  readonly remainingRecords: number;
  readonly estimatedTime?: number;
}

export interface ImportRecoveryOptions {
  readonly action: 'resume' | 'retry' | 'cancel';
  readonly sessionId: string;
  readonly skipErrors?: boolean;
  readonly startFromIndex?: number;
}

export interface ChunkRollbackInfo {
  readonly chunkNumber: number;
  readonly chunkSize: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly reason: string;
  readonly recordsAffected: number;
}
