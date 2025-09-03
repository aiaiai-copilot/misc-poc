import { Tag } from './tag';
import { TagNormalizer } from './tag-normalizer';
import { TagValidator, TagValidationResult } from './tag-validator';

export class TagFactory {
  private readonly normalizer: TagNormalizer;
  private readonly validator: TagValidator;

  constructor(normalizer?: TagNormalizer, validator?: TagValidator) {
    this.normalizer = normalizer || new TagNormalizer();
    this.validator = validator || new TagValidator();
  }

  createFromString(input: string): Tag {
    // First validate the raw input for null/undefined
    if (input === null || input === undefined) {
      throw new Error('Cannot create tag: Tag cannot be null or undefined');
    }

    // Normalize the input
    let normalizedValue: string;
    try {
      normalizedValue = this.normalizer.normalize(input);
    } catch (error) {
      // Re-throw normalization errors as-is
      throw error;
    }

    // Handle edge case where normalization results in empty string
    // (e.g., input was only whitespace)
    if (normalizedValue.trim() === '') {
      throw new Error('Cannot create tag: Tag cannot be empty');
    }

    // Validate the normalized value
    const validationResult: TagValidationResult =
      this.validator.validate(normalizedValue);

    if (!validationResult.isValid) {
      // Combine all validation errors into a single error message
      const errorMessage = validationResult.errors.join(', ');
      throw new Error(`Cannot create tag: ${errorMessage}`);
    }

    // Create and return the Tag entity
    return Tag.create(normalizedValue);
  }
}
