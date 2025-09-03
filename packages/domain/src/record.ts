import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

export class Record {
  private readonly _id: RecordId;
  private readonly _content: RecordContent;
  private readonly _tagIds: Set<TagId>;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: RecordId,
    content: RecordContent,
    tagIds: Set<TagId>,
    createdAt: Date,
    updatedAt: Date
  ) {
    if (id == null) {
      throw new Error('Record ID cannot be null or undefined');
    }

    if (content == null) {
      throw new Error('Record content cannot be null or undefined');
    }

    if (tagIds == null) {
      throw new Error('Tag IDs set cannot be null or undefined');
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
    this._content = content;
    this._tagIds = new Set(tagIds); // Create a defensive copy
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(content: RecordContent, tagIds: Set<TagId>): Record {
    const now = new Date();
    return new Record(RecordId.generate(), content, tagIds, now, now);
  }

  get id(): RecordId {
    return this._id;
  }

  get content(): RecordContent {
    return this._content;
  }

  get tagIds(): Set<TagId> {
    return new Set(this._tagIds); // Return defensive copy to maintain immutability
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  hasTag(tagId: TagId): boolean {
    if (tagId == null) {
      return false;
    }

    for (const existingTagId of this._tagIds) {
      if (existingTagId.equals(tagId)) {
        return true;
      }
    }

    return false;
  }

  hasSameTagSet(other: Record): boolean {
    if (!other || !(other instanceof Record)) {
      return false;
    }

    if (this._tagIds.size !== other._tagIds.size) {
      return false;
    }

    for (const tagId of this._tagIds) {
      if (!other.hasTag(tagId)) {
        return false;
      }
    }

    return true;
  }

  equals(other: Record): boolean {
    if (!other || !(other instanceof Record)) {
      return false;
    }

    return this._id.equals(other._id);
  }

  updateTags(newTagIds: Set<TagId>): Record {
    if (newTagIds == null) {
      throw new Error('Tag IDs set cannot be null or undefined');
    }

    return new Record(
      this._id,
      this._content,
      newTagIds,
      this._createdAt,
      new Date() // Update the updatedAt timestamp
    );
  }

  toString(): string {
    return `Record(${this._id.toString()}, ${this._content.toString()})`;
  }

  toJSON(): {
    id: string;
    content: string;
    tagIds: string[];
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this._id.toString(),
      content: this._content.toString(),
      tagIds: Array.from(this._tagIds).map((tagId) => tagId.toString()),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
