export class GoogleId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): GoogleId {
    if (value == null) {
      throw new Error('Google ID cannot be null or undefined');
    }

    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      throw new Error('Google ID cannot be empty');
    }

    if (trimmedValue.length < 10 || trimmedValue.length > 50) {
      throw new Error('Google ID must be between 10 and 50 characters');
    }

    // Google IDs should only contain alphanumeric characters
    const validPattern = /^[a-zA-Z0-9]+$/;
    if (!validPattern.test(trimmedValue)) {
      throw new Error('Google ID contains invalid characters');
    }

    return new GoogleId(trimmedValue);
  }

  equals(other: GoogleId): boolean {
    if (!other || !(other instanceof GoogleId)) {
      return false;
    }

    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
