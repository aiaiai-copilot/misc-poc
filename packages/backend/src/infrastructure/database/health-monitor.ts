/**
 * Database Health Monitoring and Logging Module
 * Provides comprehensive monitoring, alerting, and logging for database health
 */

import { EventEmitter } from 'events';
import {
  DatabaseHealthChecker,
  HealthCheckResult,
  HealthCheckOptions,
} from './connection-health';

export interface HealthEvent {
  type: 'healthy' | 'unhealthy' | 'recovered' | 'degraded';
  result: HealthCheckResult;
  previousState?: boolean;
  consecutiveFailures?: number;
  uptimePercentage?: number;
}

export interface MonitorConfig {
  interval: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  alertThreshold: number; // Number of consecutive failures before alert
  degradedThreshold: number; // Response time threshold for degraded state (ms)
  statsWindow: number; // Time window for statistics (ms)
  enableMetrics: boolean;
}

export interface HealthStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number;
  averageResponseTime: number;
  lastCheckTime: Date;
  lastSuccessTime: Date | null;
  lastFailureTime: Date | null;
  consecutiveFailures: number;
  maxResponseTime: number;
  minResponseTime: number;
  currentState: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
}

export class DatabaseHealthMonitor extends EventEmitter {
  private healthChecker: DatabaseHealthChecker;
  private config: MonitorConfig;
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private stats: HealthStats;
  private recentResults: HealthCheckResult[] = [];

  constructor(
    healthChecker: DatabaseHealthChecker,
    config: Partial<MonitorConfig> = {}
  ) {
    super();

    this.healthChecker = healthChecker;
    this.config = {
      interval: 30000, // 30 seconds
      enableLogging: true,
      logLevel: 'info',
      alertThreshold: 3,
      degradedThreshold: 5000, // 5 seconds
      statsWindow: 300000, // 5 minutes
      enableMetrics: true,
      ...config,
    };

    this.stats = this.initializeStats();
    this.setupEventListeners();
  }

  /**
   * Start monitoring database health
   */
  start(options?: Partial<HealthCheckOptions>): void {
    if (this.isMonitoring) {
      this.log('warn', 'Monitor is already running');
      return;
    }

    this.log('info', 'Starting database health monitoring', {
      interval: this.config.interval,
      alertThreshold: this.config.alertThreshold,
    });

    this.isMonitoring = true;
    this.stats = this.initializeStats();

    this.monitorInterval = setInterval(async () => {
      try {
        await this.performHealthCheck(options);
      } catch (error) {
        this.log('error', 'Error during health check', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.interval);

    // Perform initial check
    this.performHealthCheck(options).catch((error) => {
      this.log('error', 'Error during initial health check', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      this.log('warn', 'Monitor is not running');
      return;
    }

    this.log('info', 'Stopping database health monitoring');

    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Get current health statistics
   */
  getStats(): HealthStats {
    return { ...this.stats };
  }

  /**
   * Get recent health check results
   */
  getRecentResults(count: number = 10): HealthCheckResult[] {
    return this.recentResults.slice(-count);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.log('info', 'Resetting health statistics');
    this.stats = this.initializeStats();
    this.recentResults = [];
  }

  /**
   * Perform a manual health check
   */
  async checkNow(
    options?: Partial<HealthCheckOptions>
  ): Promise<HealthCheckResult> {
    const result = await this.healthChecker.checkHealth(options);
    this.processHealthResult(result);
    return result;
  }

  /**
   * Check if database is currently healthy
   */
  isHealthy(): boolean {
    return this.stats.currentState === 'healthy';
  }

  /**
   * Check if database is degraded (slow but working)
   */
  isDegraded(): boolean {
    return this.stats.currentState === 'degraded';
  }

  private async performHealthCheck(
    options?: Partial<HealthCheckOptions>
  ): Promise<void> {
    const result = await this.healthChecker.checkHealth(options);
    this.processHealthResult(result);
  }

  private processHealthResult(result: HealthCheckResult): void {
    this.updateStats(result);
    this.addToRecentResults(result);

    const previousState = this.stats.currentState;
    const newState = this.determineHealthState(result);

    if (newState !== previousState) {
      this.handleStateChange(previousState, newState, result);
    }

    this.stats.currentState = newState;
    this.logHealthResult(result, newState);
    this.emitHealthEvent(result, previousState, newState);
  }

  private determineHealthState(
    result: HealthCheckResult
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (!result.isHealthy) {
      return 'unhealthy';
    }

    if (result.responseTime > this.config.degradedThreshold) {
      return 'degraded';
    }

    return 'healthy';
  }

  private handleStateChange(
    previousState: string,
    newState: string,
    result: HealthCheckResult
  ): void {
    this.log(
      'info',
      `Database state changed: ${previousState} -> ${newState}`,
      {
        responseTime: result.responseTime,
        consecutiveFailures: this.stats.consecutiveFailures,
      }
    );

    // Alert on critical state changes
    if (
      newState === 'unhealthy' &&
      this.stats.consecutiveFailures >= this.config.alertThreshold
    ) {
      this.log(
        'error',
        'Database health alert: Multiple consecutive failures',
        {
          consecutiveFailures: this.stats.consecutiveFailures,
          threshold: this.config.alertThreshold,
        }
      );
    }

    if (previousState === 'unhealthy' && newState === 'healthy') {
      this.log('info', 'Database recovered from unhealthy state', {
        downTime: this.calculateDownTime(),
      });
    }
  }

  private updateStats(result: HealthCheckResult): void {
    this.stats.totalChecks++;
    this.stats.lastCheckTime = result.timestamp;

    if (result.isHealthy) {
      this.stats.successfulChecks++;
      this.stats.consecutiveFailures = 0;
      this.stats.lastSuccessTime = result.timestamp;

      // Update response time stats
      if (
        this.stats.maxResponseTime === 0 ||
        result.responseTime > this.stats.maxResponseTime
      ) {
        this.stats.maxResponseTime = result.responseTime;
      }

      if (
        this.stats.minResponseTime === 0 ||
        result.responseTime < this.stats.minResponseTime
      ) {
        this.stats.minResponseTime = result.responseTime;
      }

      // Calculate average response time
      this.stats.averageResponseTime = this.calculateAverageResponseTime();
    } else {
      this.stats.failedChecks++;
      this.stats.consecutiveFailures++;
      this.stats.lastFailureTime = result.timestamp;
    }

    // Calculate uptime percentage
    this.stats.uptimePercentage =
      this.stats.totalChecks > 0
        ? (this.stats.successfulChecks / this.stats.totalChecks) * 100
        : 0;
  }

  private addToRecentResults(result: HealthCheckResult): void {
    this.recentResults.push(result);

    // Keep only results within the stats window
    const cutoffTime = Date.now() - this.config.statsWindow;
    this.recentResults = this.recentResults.filter(
      (r) => r.timestamp.getTime() > cutoffTime
    );
  }

  private calculateAverageResponseTime(): number {
    const healthyResults = this.recentResults.filter((r) => r.isHealthy);
    if (healthyResults.length === 0) return 0;

    const totalTime = healthyResults.reduce(
      (sum, r) => sum + r.responseTime,
      0
    );
    return Math.round(totalTime / healthyResults.length);
  }

  private calculateDownTime(): number {
    if (!this.stats.lastFailureTime || !this.stats.lastSuccessTime) return 0;
    return (
      this.stats.lastSuccessTime.getTime() -
      this.stats.lastFailureTime.getTime()
    );
  }

  private logHealthResult(result: HealthCheckResult, state: string): void {
    if (!this.config.enableLogging) return;

    const logData = {
      state,
      responseTime: result.responseTime,
      attempt: result.attempt,
      host: result.connectionInfo.host,
      port: result.connectionInfo.port,
      database: result.connectionInfo.database,
    };

    if (result.isHealthy) {
      if (state === 'degraded') {
        this.log('warn', 'Database is degraded (slow response)', logData);
      } else {
        this.log('debug', 'Database health check passed', logData);
      }
    } else {
      this.log('error', 'Database health check failed', {
        ...logData,
        error: result.error?.message,
        consecutiveFailures: this.stats.consecutiveFailures,
      });
    }
  }

  private emitHealthEvent(
    result: HealthCheckResult,
    previousState: string,
    newState: string
  ): void {
    let eventType: HealthEvent['type'];

    if (newState === 'healthy' && previousState !== 'healthy') {
      eventType = 'recovered';
    } else if (newState === 'unhealthy') {
      eventType = 'unhealthy';
    } else if (newState === 'degraded') {
      eventType = 'degraded';
    } else {
      eventType = 'healthy';
    }

    const event: HealthEvent = {
      type: eventType,
      result,
      previousState:
        previousState !== 'unknown' ? previousState === 'healthy' : undefined,
      consecutiveFailures: this.stats.consecutiveFailures,
      uptimePercentage: this.stats.uptimePercentage,
    };

    this.emit('health', event);
    this.emit(eventType, event);
  }

  private setupEventListeners(): void {
    this.on('unhealthy', (event: HealthEvent) => {
      if (
        event.consecutiveFailures &&
        event.consecutiveFailures >= this.config.alertThreshold
      ) {
        this.emit('alert', {
          type: 'consecutive_failures',
          message: `Database has failed ${event.consecutiveFailures} consecutive health checks`,
          event,
        });
      }
    });

    this.on('degraded', (event: HealthEvent) => {
      this.emit('alert', {
        type: 'performance_degraded',
        message: `Database response time is degraded: ${event.result.responseTime}ms`,
        event,
      });
    });
  }

  private initializeStats(): HealthStats {
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      uptimePercentage: 0,
      averageResponseTime: 0,
      lastCheckTime: new Date(),
      lastSuccessTime: null,
      lastFailureTime: null,
      consecutiveFailures: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      currentState: 'unknown',
    };
  }

  private log(
    level: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.config.enableLogging) return;

    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.config.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);

    if (messageLevelIndex < currentLevelIndex) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      component: 'DatabaseHealthMonitor',
      ...data,
    };

    // In a real application, you'd use a proper logging library
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Create a health monitor for the default database
 */
export function createHealthMonitor(
  healthChecker?: DatabaseHealthChecker,
  config?: Partial<MonitorConfig>
): DatabaseHealthMonitor {
  const checker = healthChecker || new DatabaseHealthChecker();
  return new DatabaseHealthMonitor(checker, config);
}

/**
 * Create a health monitor for the test database
 */
export function createTestHealthMonitor(
  config?: Partial<MonitorConfig>
): DatabaseHealthMonitor {
  const checker = DatabaseHealthChecker.createTestChecker();
  return new DatabaseHealthMonitor(checker, config);
}
