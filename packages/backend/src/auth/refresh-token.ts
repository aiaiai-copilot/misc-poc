import 'reflect-metadata';
import { DataSource, Repository, MoreThan, LessThan } from 'typeorm';
import crypto from 'crypto';
import { RefreshToken } from './entities/refresh-token.js';
import { JwtService } from './jwt.js';
import { AuthConfig } from './config.js';

/**
 * Interface for token rotation result
 */
export interface TokenRotationResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Interface for JWT payload during token rotation
 */
export interface JwtRotationPayload {
  userId: string;
  email: string;
}

/**
 * Interface for cleanup statistics
 */
export interface CleanupStatistics {
  expiredTokensRemoved: number;
  oldRevokedTokensRemoved: number;
  totalTokensRemoved: number;
  cleanupDate: Date;
}

/**
 * Refresh Token Service
 *
 * Implements secure refresh token rotation mechanism as specified in PRD:
 * - Cryptographically secure token generation
 * - Token rotation on refresh
 * - Token blacklisting for security
 * - Automatic cleanup of expired tokens
 */
export class RefreshTokenService {
  private refreshTokenRepository: Repository<RefreshToken>;
  private jwtService: JwtService;

  constructor(
    private dataSource: DataSource,
    config: AuthConfig
  ) {
    this.refreshTokenRepository = dataSource.getRepository(RefreshToken);
    this.jwtService = new JwtService(config);
  }

  /**
   * Generate a new cryptographically secure refresh token
   *
   * @param userId - User ID this token belongs to
   * @param deviceId - Device/client identifier
   * @param ip - Optional IP address for security monitoring
   * @param userAgent - Optional user agent for device identification
   * @returns Promise resolving to the generated refresh token
   */
  async generateRefreshToken(
    userId: string,
    deviceId: string,
    ip?: string,
    userAgent?: string
  ): Promise<RefreshToken> {
    // Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const tokenBytes = crypto.randomBytes(32);
    const token = tokenBytes.toString('hex');

    // Set expiration to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      deviceId,
      expiresAt,
      lastUsedIp: ip,
      userAgent,
      isRevoked: false,
      usageCount: 0,
    });

    return await this.refreshTokenRepository.save(refreshToken);
  }

  /**
   * Rotate tokens: generate new access and refresh token pair, revoke old refresh token
   *
   * @param refreshTokenString - The refresh token to rotate
   * @param jwtPayload - Payload for the new JWT access token
   * @param ip - Optional IP address for security monitoring
   * @param userAgent - Optional user agent for device identification
   * @returns Promise resolving to new token pair
   */
  async rotateTokens(
    refreshTokenString: string,
    jwtPayload: JwtRotationPayload,
    ip?: string,
    userAgent?: string
  ): Promise<TokenRotationResult> {
    // Validate refresh token format
    if (
      !refreshTokenString ||
      typeof refreshTokenString !== 'string' ||
      refreshTokenString.length < 32
    ) {
      throw new Error('Invalid refresh token');
    }

    // Find and validate the refresh token
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
    });

    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Check if token is expired
    if (refreshToken.isExpired()) {
      throw new Error('Refresh token expired');
    }

    // Check if token is revoked
    if (refreshToken.isRevoked) {
      throw new Error('Refresh token revoked');
    }

    // Start database transaction to ensure atomicity and prevent concurrent rotation
    return await this.dataSource.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(RefreshToken);

      // Re-check token status within transaction with pessimistic locking to handle concurrent requests
      const currentToken = await tokenRepo.findOne({
        where: { token: refreshTokenString },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentToken || currentToken.isRevoked || currentToken.isExpired()) {
        throw new Error('Refresh token revoked');
      }

      // Update usage statistics for the old token
      currentToken.updateUsage(ip, userAgent);

      // Revoke the old refresh token
      currentToken.revoke('token_rotation');
      await tokenRepo.save(currentToken);

      // Generate new access token
      const accessToken = this.jwtService.generateToken({
        userId: jwtPayload.userId,
        email: jwtPayload.email,
      });

      // Generate new refresh token
      const newRefreshToken = tokenRepo.create({
        token: crypto.randomBytes(32).toString('hex'),
        userId: currentToken.userId,
        deviceId: currentToken.deviceId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lastUsedIp: ip,
        userAgent,
        isRevoked: false,
        usageCount: 0,
      });

      await tokenRepo.save(newRefreshToken);

      return {
        accessToken,
        refreshToken: newRefreshToken.token,
      };
    });
  }

  /**
   * Revoke a specific refresh token
   *
   * @param refreshTokenString - The refresh token to revoke
   * @param reason - Optional reason for revocation
   */
  async revokeRefreshToken(
    refreshTokenString: string,
    reason?: string
  ): Promise<void> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
    });

    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    refreshToken.revoke(reason);
    await this.refreshTokenRepository.save(refreshToken);
  }

  /**
   * Revoke all refresh tokens for a specific user
   * Useful for logout or security breach response
   *
   * @param userId - User ID to revoke all tokens for
   * @param reason - Optional reason for revocation
   */
  async revokeAllUserRefreshTokens(
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revocationReason: reason || 'logout_all_devices',
      })
      .where('userId = :userId', { userId })
      .andWhere('isRevoked = :isRevoked', { isRevoked: false })
      .execute();
  }

  /**
   * Revoke all refresh tokens for a specific device
   * Useful for device-specific logout or security response
   *
   * @param userId - User ID
   * @param deviceId - Device ID to revoke tokens for
   * @param reason - Optional reason for revocation
   */
  async revokeDeviceRefreshTokens(
    userId: string,
    deviceId: string,
    reason?: string
  ): Promise<void> {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revocationReason: reason || 'device_logout',
      })
      .where('userId = :userId', { userId })
      .andWhere('deviceId = :deviceId', { deviceId })
      .andWhere('isRevoked = :isRevoked', { isRevoked: false })
      .execute();
  }

  /**
   * Handle potential security breach by revoking all user tokens
   *
   * @param userId - User ID affected by security breach
   * @param breachType - Type of security breach detected
   */
  async handleSecurityBreach(
    userId: string,
    breachType: string
  ): Promise<void> {
    await this.revokeAllUserRefreshTokens(
      userId,
      `security_breach_${breachType}`
    );
  }

  /**
   * Clean up expired refresh tokens
   * Should be run periodically to maintain database performance
   *
   * @returns Number of tokens removed
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * Clean up old revoked tokens
   * Removes revoked tokens older than the specified retention period
   *
   * @param retentionDays - Number of days to keep revoked tokens (default: 30)
   * @returns Number of tokens removed
   */
  async cleanupRevokedTokens(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('isRevoked = :isRevoked', { isRevoked: true })
      .andWhere('revokedAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Perform comprehensive periodic cleanup
   * Combines expired and old revoked token cleanup
   *
   * @param retentionDays - Days to keep revoked tokens (default: 30)
   * @returns Cleanup statistics
   */
  async performPeriodicCleanup(
    retentionDays: number = 30
  ): Promise<CleanupStatistics> {
    const expiredTokensRemoved = await this.cleanupExpiredTokens();
    const oldRevokedTokensRemoved =
      await this.cleanupRevokedTokens(retentionDays);

    return {
      expiredTokensRemoved,
      oldRevokedTokensRemoved,
      totalTokensRemoved: expiredTokensRemoved + oldRevokedTokensRemoved,
      cleanupDate: new Date(),
    };
  }

  /**
   * Get active refresh tokens for a user
   * Useful for security monitoring and device management
   *
   * @param userId - User ID
   * @returns Array of active refresh tokens
   */
  async getActiveUserTokens(userId: string): Promise<RefreshToken[]> {
    return await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Get refresh token statistics for monitoring
   *
   * @returns Object containing various statistics
   */
  async getTokenStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }> {
    const now = new Date();

    const [totalTokens, activeTokens, expiredTokens, revokedTokens] =
      await Promise.all([
        this.refreshTokenRepository.count(),
        this.refreshTokenRepository.count({
          where: {
            isRevoked: false,
            expiresAt: MoreThan(now),
          },
        }),
        this.refreshTokenRepository.count({
          where: {
            expiresAt: LessThan(now),
          },
        }),
        this.refreshTokenRepository.count({
          where: {
            isRevoked: true,
          },
        }),
      ]);

    return {
      totalTokens,
      activeTokens,
      expiredTokens,
      revokedTokens,
    };
  }

  /**
   * Validate if a refresh token is valid and active
   *
   * @param refreshTokenString - Token to validate
   * @returns Promise resolving to the token if valid, null if invalid
   */
  async validateRefreshToken(
    refreshTokenString: string
  ): Promise<RefreshToken | null> {
    if (!refreshTokenString || typeof refreshTokenString !== 'string') {
      return null;
    }

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
    });

    if (!refreshToken || !refreshToken.isValid()) {
      return null;
    }

    return refreshToken;
  }
}
