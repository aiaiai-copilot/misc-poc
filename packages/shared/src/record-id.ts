import { generateUuid, validateUuid } from './uuid-utils';

export class RecordId {
  private readonly _value: string;

  constructor(uuid: string) {
    if (uuid == null) {
      throw new Error('RecordId UUID cannot be null or undefined');
    }

    const validationResult = validateUuid(uuid);
    if (validationResult.isErr()) {
      throw new Error(`Invalid RecordId: ${validationResult.unwrapErr()}`);
    }

    this._value = uuid.toLowerCase();
  }

  static generate(): RecordId {
    return new RecordId(generateUuid());
  }

  get value(): string {
    return this._value;
  }

  equals(other: RecordId): boolean {
    if (!other || !(other instanceof RecordId)) {
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