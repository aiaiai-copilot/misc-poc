import { generateUuid, validateUuid } from './uuid-utils';

export class TagId {
  private readonly _value: string;

  constructor(uuid: string) {
    if (uuid == null) {
      throw new Error('TagId UUID cannot be null or undefined');
    }

    const validationResult = validateUuid(uuid);
    if (validationResult.isErr()) {
      throw new Error(`Invalid TagId: ${validationResult.unwrapErr()}`);
    }

    this._value = uuid.toLowerCase();
  }

  static generate(): TagId {
    return new TagId(generateUuid());
  }

  get value(): string {
    return this._value;
  }

  equals(other: TagId): boolean {
    if (!other || !(other instanceof TagId)) {
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