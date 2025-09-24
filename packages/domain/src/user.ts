import { RecordId } from '@misc-poc/shared';
import { GoogleId } from './google-id';
import { UserSettings } from './user-settings';

export class User {
  private readonly _id: RecordId;
  private readonly _email: string;
  private readonly _googleId: GoogleId;
  private readonly _displayName: string;
  private readonly _avatarUrl: string;
  private readonly _settings: UserSettings;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private readonly _lastLoginAt: Date | null;

  constructor(
    id: RecordId,
    email: string,
    googleId: GoogleId,
    displayName: string,
    avatarUrl: string,
    settings: UserSettings,
    createdAt: Date,
    updatedAt: Date,
    lastLoginAt: Date | null
  ) {
    if (id == null) {
      throw new Error('User ID cannot be null or undefined');
    }

    if (email == null) {
      throw new Error('Email cannot be null or undefined');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (googleId == null) {
      throw new Error('Google ID cannot be null or undefined');
    }

    if (settings == null) {
      throw new Error('User settings cannot be null or undefined');
    }

    if (createdAt == null) {
      throw new Error('Created date cannot be null or undefined');
    }

    if (updatedAt == null) {
      throw new Error('Updated date cannot be null or undefined');
    }

    if (updatedAt.getTime() < createdAt.getTime()) {
      throw new Error('Updated date cannot be before created date');
    }

    this._id = id;
    this._email = email;
    this._googleId = googleId;
    this._displayName = displayName ?? '';
    this._avatarUrl = avatarUrl ?? '';
    this._settings = settings;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._lastLoginAt = lastLoginAt;
  }

  private isValidEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  static create(
    email: string,
    googleId: GoogleId,
    displayName: string,
    avatarUrl: string
  ): User {
    const now = new Date();
    return new User(
      RecordId.generate(),
      email,
      googleId,
      displayName,
      avatarUrl,
      UserSettings.createDefault(),
      now,
      now,
      null
    );
  }

  get id(): RecordId {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get googleId(): GoogleId {
    return this._googleId;
  }

  get displayName(): string {
    return this._displayName;
  }

  get avatarUrl(): string {
    return this._avatarUrl;
  }

  get settings(): UserSettings {
    return this._settings;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  updateSettings(newSettings: UserSettings): User {
    return new User(
      this._id,
      this._email,
      this._googleId,
      this._displayName,
      this._avatarUrl,
      newSettings,
      this._createdAt,
      new Date(),
      this._lastLoginAt
    );
  }

  recordLogin(loginTime: Date): User {
    return new User(
      this._id,
      this._email,
      this._googleId,
      this._displayName,
      this._avatarUrl,
      this._settings,
      this._createdAt,
      loginTime >= this._updatedAt ? loginTime : new Date(),
      loginTime
    );
  }

  equals(other: User): boolean {
    if (!other || !(other instanceof User)) {
      return false;
    }

    return this._id.equals(other._id);
  }

  toString(): string {
    return `User(${this._id.toString()}, ${this._email})`;
  }

  toJSON(): {
    id: string;
    email: string;
    googleId: string;
    displayName: string;
    avatarUrl: string;
    settings: {
      caseSensitive: boolean;
      removeAccents: boolean;
      maxTagLength: number;
      maxTagsPerRecord: number;
      uiLanguage: string;
    };
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  } {
    return {
      id: this._id.toString(),
      email: this._email,
      googleId: this._googleId.toString(),
      displayName: this._displayName,
      avatarUrl: this._avatarUrl,
      settings: {
        caseSensitive: this._settings.caseSensitive,
        removeAccents: this._settings.removeAccents,
        maxTagLength: this._settings.maxTagLength,
        maxTagsPerRecord: this._settings.maxTagsPerRecord,
        uiLanguage: this._settings.uiLanguage,
      },
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      lastLoginAt: this._lastLoginAt?.toISOString() ?? null,
    };
  }
}
