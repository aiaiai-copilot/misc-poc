import { TagNormalizerConfig } from './tag-normalizer';

export class UserSettings {
  private readonly _caseSensitive: boolean;
  private readonly _removeAccents: boolean;
  private readonly _maxTagLength: number;
  private readonly _maxTagsPerRecord: number;
  private readonly _uiLanguage: string;

  constructor(
    caseSensitive: boolean,
    removeAccents: boolean,
    maxTagLength: number,
    maxTagsPerRecord: number,
    uiLanguage: string
  ) {
    this.validateMaxTagLength(maxTagLength);
    this.validateMaxTagsPerRecord(maxTagsPerRecord);
    this.validateUiLanguage(uiLanguage);

    this._caseSensitive = caseSensitive;
    this._removeAccents = removeAccents;
    this._maxTagLength = maxTagLength;
    this._maxTagsPerRecord = maxTagsPerRecord;
    this._uiLanguage = uiLanguage;
  }

  private validateMaxTagLength(maxTagLength: number): void {
    if (maxTagLength == null) {
      throw new Error('Max tag length cannot be null or undefined');
    }

    if (maxTagLength < 1 || maxTagLength > 500) {
      throw new Error('Max tag length must be between 1 and 500');
    }
  }

  private validateMaxTagsPerRecord(maxTagsPerRecord: number): void {
    if (maxTagsPerRecord == null) {
      throw new Error('Max tags per record cannot be null or undefined');
    }

    if (maxTagsPerRecord < 1 || maxTagsPerRecord > 1000) {
      throw new Error('Max tags per record must be between 1 and 1000');
    }
  }

  private validateUiLanguage(uiLanguage: string): void {
    if (uiLanguage == null) {
      throw new Error('UI language cannot be null or undefined');
    }

    const trimmedLanguage = uiLanguage.trim();
    if (trimmedLanguage === '') {
      throw new Error('UI language cannot be empty');
    }

    // ISO 639-1 language codes are exactly 2 characters
    const iso639Pattern = /^[a-z]{2}$/;
    if (!iso639Pattern.test(trimmedLanguage)) {
      throw new Error('UI language must be a valid ISO 639-1 code');
    }
  }

  static createDefault(): UserSettings {
    return new UserSettings(false, true, 100, 50, 'en');
  }

  get caseSensitive(): boolean {
    return this._caseSensitive;
  }

  get removeAccents(): boolean {
    return this._removeAccents;
  }

  get maxTagLength(): number {
    return this._maxTagLength;
  }

  get maxTagsPerRecord(): number {
    return this._maxTagsPerRecord;
  }

  get uiLanguage(): string {
    return this._uiLanguage;
  }

  equals(other: UserSettings): boolean {
    if (!other || !(other instanceof UserSettings)) {
      return false;
    }

    return (
      this._caseSensitive === other._caseSensitive &&
      this._removeAccents === other._removeAccents &&
      this._maxTagLength === other._maxTagLength &&
      this._maxTagsPerRecord === other._maxTagsPerRecord &&
      this._uiLanguage === other._uiLanguage
    );
  }

  withUpdatedSettings(updates: {
    caseSensitive?: boolean;
    removeAccents?: boolean;
    maxTagLength?: number;
    maxTagsPerRecord?: number;
    uiLanguage?: string;
  }): UserSettings {
    const newCaseSensitive = updates.caseSensitive ?? this._caseSensitive;
    const newRemoveAccents = updates.removeAccents ?? this._removeAccents;
    const newMaxTagLength = updates.maxTagLength ?? this._maxTagLength;
    const newMaxTagsPerRecord =
      updates.maxTagsPerRecord ?? this._maxTagsPerRecord;
    const newUiLanguage = updates.uiLanguage ?? this._uiLanguage;

    return new UserSettings(
      newCaseSensitive,
      newRemoveAccents,
      newMaxTagLength,
      newMaxTagsPerRecord,
      newUiLanguage
    );
  }

  getNormalizationConfig(): TagNormalizerConfig {
    return {
      lowercase: !this._caseSensitive,
      removeDiacritics: this._removeAccents,
    };
  }
}
