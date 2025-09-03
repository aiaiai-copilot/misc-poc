import { TagValidator, TagValidationResult } from './tag-validator';
import { TagNormalizer } from './tag-normalizer';

export class TagParser {
  private readonly validator: TagValidator;
  private readonly normalizer: TagNormalizer;

  constructor(validator?: TagValidator, normalizer?: TagNormalizer) {
    this.validator = validator || new TagValidator();
    this.normalizer = normalizer || new TagNormalizer();
  }

  parse(content: string): string[] {
    // Handle empty or whitespace-only content
    if (!content.trim()) {
      return [];
    }

    // Split content by whitespace and filter out empty tokens
    const tokens = content.split(/\s+/).filter((token) => token.length > 0);

    // Process each token: validate, normalize, and collect valid results
    const validNormalizedTags: string[] = [];
    const seenTags = new Set<string>();

    for (const token of tokens) {
      const validationResult: TagValidationResult =
        this.validator.validate(token);

      if (validationResult.isValid) {
        const normalizedTag = this.normalizer.normalize(token);

        // Only add if we haven't seen this normalized tag before
        if (!seenTags.has(normalizedTag)) {
          seenTags.add(normalizedTag);
          validNormalizedTags.push(normalizedTag);
        }
      }
    }

    return validNormalizedTags;
  }
}
