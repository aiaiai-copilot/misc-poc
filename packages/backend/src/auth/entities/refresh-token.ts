import 'reflect-metadata';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Refresh Token Entity
 *
 * Stores refresh tokens for JWT token rotation mechanism.
 * Designed for security with proper indexing and cleanup capabilities.
 */
@Entity('refresh_tokens')
@Index(['userId', 'deviceId']) // Index for device-specific queries
@Index(['expiresAt']) // Index for cleanup operations
@Index(['isRevoked', 'revokedAt']) // Index for revoked token queries
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Cryptographically secure random token string
   * Should be at least 32 characters for security
   */
  @Column({ type: 'varchar', length: 128, unique: true })
  @Index() // Index for fast token lookups
  token!: string;

  /**
   * User ID this refresh token belongs to
   */
  @Column({ type: 'uuid' })
  userId!: string;

  /**
   * Device/client identifier for this token
   * Allows for per-device token management
   */
  @Column({ type: 'varchar', length: 255 })
  deviceId!: string;

  /**
   * When this refresh token expires
   * Default: 30 days from creation
   */
  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  /**
   * Whether this token has been revoked
   * Used for blacklisting compromised tokens
   */
  @Column({ type: 'boolean', default: false })
  isRevoked!: boolean;

  /**
   * When this token was revoked (if applicable)
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt!: Date | null;

  /**
   * Reason for revocation (optional)
   * Useful for security auditing
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  revocationReason!: string | null;

  /**
   * Last IP address that used this token
   * For security monitoring
   */
  @Column({ type: 'inet', nullable: true })
  lastUsedIp!: string | null;

  /**
   * User agent of the client that last used this token
   * For security monitoring and device identification
   */
  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  /**
   * When this token was last used
   * Updated on each token rotation
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt!: Date | null;

  /**
   * Number of times this token has been used for rotation
   * Helps detect unusual usage patterns
   */
  @Column({ type: 'integer', default: 0 })
  usageCount!: number;

  /**
   * When this record was created
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  /**
   * When this record was last updated
   */
  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  /**
   * Check if this refresh token is valid for use
   */
  isValid(): boolean {
    return !this.isRevoked && this.expiresAt > new Date();
  }

  /**
   * Check if this refresh token is expired
   */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /**
   * Mark this token as revoked
   */
  revoke(reason?: string): void {
    this.isRevoked = true;
    this.revokedAt = new Date();
    if (reason) {
      this.revocationReason = reason;
    }
  }

  /**
   * Update usage statistics
   */
  updateUsage(ip?: string, userAgent?: string): void {
    this.lastUsedAt = new Date();
    this.usageCount += 1;
    if (ip) {
      this.lastUsedIp = ip;
    }
    if (userAgent) {
      this.userAgent = userAgent;
    }
  }
}
