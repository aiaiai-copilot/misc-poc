export class RecordContent {
  private static readonly MAX_LENGTH = 10000;
  private readonly _value: string;

  constructor(content: string) {
    if (content == null) {
      throw new Error('RecordContent cannot be null or undefined');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error('RecordContent cannot be empty');
    }

    if (content.length > RecordContent.MAX_LENGTH) {
      throw new Error(`RecordContent exceeds maximum length of ${RecordContent.MAX_LENGTH} characters`);
    }

    this._value = content;
  }

  get value(): string {
    return this._value;
  }

  extractTokens(): string[] {
    return this._value
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  equals(other: RecordContent): boolean {
    if (!other || !(other instanceof RecordContent)) {
      return false;
    }
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}