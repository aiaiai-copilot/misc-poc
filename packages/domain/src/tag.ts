import { TagId } from '@misc-poc/shared';

export class Tag {
  private readonly _id: TagId;
  private readonly _normalizedValue: string;

  constructor(id: TagId, normalizedValue: string) {
    if (id == null) {
      throw new Error('Tag ID cannot be null or undefined');
    }

    if (normalizedValue == null) {
      throw new Error('Normalized value cannot be null or undefined');
    }

    if (normalizedValue === '') {
      throw new Error('Normalized value cannot be empty');
    }

    if (this.containsWhitespace(normalizedValue)) {
      throw new Error('Normalized value cannot contain whitespace');
    }

    this._id = id;
    this._normalizedValue = normalizedValue;
  }

  static create(normalizedValue: string): Tag {
    return new Tag(TagId.generate(), normalizedValue);
  }

  get id(): TagId {
    return this._id;
  }

  get normalizedValue(): string {
    return this._normalizedValue;
  }

  equals(other: Tag): boolean {
    if (!other || !(other instanceof Tag)) {
      return false;
    }
    return this._id.equals(other._id);
  }

  toString(): string {
    return `Tag(${this._id.toString()}, ${this._normalizedValue})`;
  }

  toJSON(): { id: string; normalizedValue: string } {
    return {
      id: this._id.toString(),
      normalizedValue: this._normalizedValue,
    };
  }

  private containsWhitespace(value: string): boolean {
    return /\s/.test(value);
  }
}
