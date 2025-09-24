import { RecordId } from '@misc-poc/shared';
import { GoogleId } from './google-id';

export class AuthenticationContext {
  private readonly _userId: RecordId;
  private readonly _googleId: GoogleId;
  private readonly _email: string;
  private readonly _sessionStartedAt: Date;
  private readonly _lastActivityAt: Date | null;

  constructor(
    userId: RecordId,
    googleId: GoogleId,
    email: string,
    sessionStartedAt: Date,
    lastActivityAt: Date | null
  ) {
    if (userId == null) {
      throw new Error('User ID cannot be null or undefined');
    }

    if (googleId == null) {
      throw new Error('Google ID cannot be null or undefined');
    }

    if (email == null) {
      throw new Error('Email cannot be null or undefined');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (sessionStartedAt == null) {
      throw new Error('Session start time cannot be null or undefined');
    }

    if (
      lastActivityAt != null &&
      lastActivityAt.getTime() < sessionStartedAt.getTime()
    ) {
      throw new Error('Last activity time cannot be before session start time');
    }

    this._userId = userId;
    this._googleId = googleId;
    this._email = email;
    this._sessionStartedAt = sessionStartedAt;
    this._lastActivityAt = lastActivityAt;
  }

  private isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  static create(
    userId: RecordId,
    googleId: GoogleId,
    email: string
  ): AuthenticationContext {
    return new AuthenticationContext(userId, googleId, email, new Date(), null);
  }

  get userId(): RecordId {
    return this._userId;
  }

  get googleId(): GoogleId {
    return this._googleId;
  }

  get email(): string {
    return this._email;
  }

  get sessionStartedAt(): Date {
    return this._sessionStartedAt;
  }

  get lastActivityAt(): Date | null {
    return this._lastActivityAt;
  }

  updateActivity(activityTime: Date): AuthenticationContext {
    if (activityTime == null) {
      throw new Error('Activity time cannot be null or undefined');
    }

    if (activityTime.getTime() < this._sessionStartedAt.getTime()) {
      throw new Error('Last activity time cannot be before session start time');
    }

    return new AuthenticationContext(
      this._userId,
      this._googleId,
      this._email,
      this._sessionStartedAt,
      activityTime
    );
  }

  isExpired(timeoutMs: number = 86400000): boolean {
    // Default timeout is 24 hours (86400000 ms)
    const now = Date.now();
    const referenceTime = this._lastActivityAt ?? this._sessionStartedAt;
    const timeSinceActivity = now - referenceTime.getTime();

    return timeSinceActivity >= timeoutMs;
  }

  getSessionDuration(): number {
    const endTime = this._lastActivityAt ?? new Date();
    return endTime.getTime() - this._sessionStartedAt.getTime();
  }

  equals(other: AuthenticationContext): boolean {
    if (!other || !(other instanceof AuthenticationContext)) {
      return false;
    }

    return (
      this._userId.equals(other._userId) &&
      this._sessionStartedAt.getTime() === other._sessionStartedAt.getTime()
    );
  }
}
