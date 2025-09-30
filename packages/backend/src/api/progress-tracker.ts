/**
 * Progress Tracker for Import/Export Operations
 * Task 12.5: Real-time progress reporting with Server-Sent Events
 *
 * Manages progress state for long-running operations and provides
 * SSE streaming capabilities for real-time updates.
 */

import { Response } from 'express';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface ProgressUpdate {
  processed: number;
  total: number;
  percentage: number;
  status: 'started' | 'processing' | 'completed' | 'error';
  currentOperation?: string;
  log?: string;
  estimatedTimeRemaining?: number; // in seconds
  estimatedCompletionTime?: string; // ISO timestamp
  imported?: number;
  skipped?: number;
  errors?: string[];
  exportData?: unknown;
  error?: string;
}

interface ProgressSession {
  userId: string;
  emitter: EventEmitter;
  startTime: number;
  updates: ProgressUpdate[];
  completed: boolean;
}

/**
 * Progress Tracker Singleton
 * Manages all active progress sessions
 */
class ProgressTracker {
  private sessions: Map<string, ProgressSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up completed sessions every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldSessions();
      },
      5 * 60 * 1000
    );

    // Use unref() so this interval doesn't prevent Node.js from exiting
    this.cleanupInterval.unref();
  }

  /**
   * Create a new progress session
   */
  createSession(userId: string): string {
    const sessionId = randomUUID();
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100); // Allow multiple listeners

    this.sessions.set(sessionId, {
      userId,
      emitter,
      startTime: Date.now(),
      updates: [],
      completed: false,
    });

    return sessionId;
  }

  /**
   * Get session by ID with user validation
   */
  getSession(sessionId: string, userId: string): ProgressSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Validate user owns this session
    if (session.userId !== userId) {
      return null;
    }

    return session;
  }

  /**
   * Check if session exists and belongs to user
   */
  validateSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && session.userId === userId;
  }

  /**
   * Send progress update to session
   */
  sendUpdate(sessionId: string, update: Partial<ProgressUpdate>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Calculate estimated time remaining if not provided
    const fullUpdate = this.enrichUpdate(session, update);

    session.updates.push(fullUpdate);
    session.emitter.emit('progress', fullUpdate);

    // Mark as completed if status is completed or error
    if (fullUpdate.status === 'completed' || fullUpdate.status === 'error') {
      session.completed = true;
    }
  }

  /**
   * Enrich update with calculated fields
   */
  private enrichUpdate(
    session: ProgressSession,
    update: Partial<ProgressUpdate>
  ): ProgressUpdate {
    const processed = update.processed ?? 0;
    const total = update.total ?? 100;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    let estimatedCompletionTime: string | undefined;

    if (processed > 0 && processed < total) {
      const elapsed = (Date.now() - session.startTime) / 1000; // seconds
      const rate = processed / elapsed; // records per second
      const remaining = total - processed;
      estimatedTimeRemaining = Math.round(remaining / rate);
      estimatedCompletionTime = new Date(
        Date.now() + estimatedTimeRemaining * 1000
      ).toISOString();
    }

    return {
      processed,
      total,
      percentage,
      status: update.status ?? 'processing',
      currentOperation: update.currentOperation,
      log: update.log,
      estimatedTimeRemaining,
      estimatedCompletionTime,
      imported: update.imported,
      skipped: update.skipped,
      errors: update.errors,
      exportData: update.exportData,
      error: update.error,
    };
  }

  /**
   * Attach SSE response to session
   */
  attachSSE(sessionId: string, res: Response): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send existing updates immediately
    for (const update of session.updates) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }

    // If already completed, close immediately
    if (session.completed) {
      res.end();
      return;
    }

    // Listen for new updates
    const onProgress = (update: ProgressUpdate): void => {
      res.write(`data: ${JSON.stringify(update)}\n\n`);

      // Close connection if completed or error
      if (update.status === 'completed' || update.status === 'error') {
        res.end();
      }
    };

    session.emitter.on('progress', onProgress);

    // Cleanup on client disconnect
    res.on('close', () => {
      session.emitter.removeListener('progress', onProgress);
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000); // 15 seconds

    res.on('close', () => {
      clearInterval(heartbeat);
    });
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.emitter.removeAllListeners();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Clean up old completed sessions (older than 5 minutes)
   */
  private cleanupOldSessions(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.completed && session.startTime < fiveMinutesAgo) {
        this.removeSession(sessionId);
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const sessionId of this.sessions.keys()) {
      this.removeSession(sessionId);
    }
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();
