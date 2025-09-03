import { Record } from './record';
import { TagParser } from './tag-parser';
import { TagFactory } from './tag-factory';
import { RecordContent, TagId } from '@misc-poc/shared';

export class RecordFactory {
  private readonly tagParser: TagParser;
  private readonly tagFactory: TagFactory;

  constructor(tagParser?: TagParser, tagFactory?: TagFactory) {
    this.tagParser = tagParser || new TagParser();
    this.tagFactory = tagFactory || new TagFactory();
  }

  createFromContent(content: string): Record {
    // Validate input
    if (content === null || content === undefined) {
      throw new Error(
        'Cannot create record: Content cannot be null or undefined'
      );
    }

    if (content.trim() === '') {
      throw new Error('Cannot create record: Content cannot be empty');
    }

    // Create RecordContent value object
    const recordContent = new RecordContent(content);

    // Parse tags from content
    const tagStrings = this.tagParser.parse(content);

    // Create tags and collect their IDs
    const tagIds = new Set<TagId>();
    for (const tagString of tagStrings) {
      try {
        const tag = this.tagFactory.createFromString(tagString);
        tagIds.add(tag.id);
      } catch (error) {
        // Re-throw tag creation errors to maintain error transparency
        throw error;
      }
    }

    // Create and return the Record using the static factory method
    return Record.create(recordContent, tagIds);
  }
}
