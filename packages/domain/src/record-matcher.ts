import { Record } from './record';
import { Tag } from './tag';
import { TagId, SearchQuery } from '@misc-poc/shared';

export class RecordMatcher {
  matches(
    record: Record,
    query: SearchQuery,
    tagLookup: Map<TagId, Tag>
  ): boolean {
    if (!record || !query || !tagLookup) {
      return false;
    }

    // Empty query matches everything
    if (query.isEmpty()) {
      return true;
    }

    const normalizedQueryTokens = query.getNormalizedTokens();

    // Get all normalized tag values for this record
    const recordTagValues = this.getRecordTagValues(record, tagLookup);

    // AND logic: all query tokens must match at least one tag
    return normalizedQueryTokens.every((token: string) =>
      recordTagValues.some((tagValue) => tagValue.includes(token))
    );
  }

  private getRecordTagValues(
    record: Record,
    tagLookup: Map<TagId, Tag>
  ): string[] {
    const tagValues: string[] = [];

    for (const tagId of record.tagIds) {
      const tag = tagLookup.get(tagId);
      if (tag) {
        tagValues.push(tag.normalizedValue);
      }
    }

    return tagValues;
  }
}
