export interface TagValidationResult {
  isValid: boolean;
  errors: string[];
  tag: string | null | undefined;
}

export class TagValidator {
  private readonly FORBIDDEN_CHARACTERS = [
    '{',
    '}',
    '[',
    ']',
    ':',
    ',',
    '"',
    '\\',
  ];
  private readonly MAX_LENGTH = 100;

  validate(tag: string | null | undefined): TagValidationResult {
    const result: TagValidationResult = {
      isValid: true,
      errors: [],
      tag,
    };

    // Check for null or undefined
    if (tag === null || tag === undefined) {
      result.isValid = false;
      result.errors.push('Tag cannot be null or undefined');
      return result;
    }

    // Check for empty string
    if (tag.length === 0) {
      result.isValid = false;
      result.errors.push('Tag cannot be empty');
      return result;
    }

    // Check length constraints
    if (tag.length > this.MAX_LENGTH) {
      result.isValid = false;
      result.errors.push('Tag cannot exceed 100 characters');
    }

    // Check for whitespace characters
    if (this.containsWhitespace(tag)) {
      result.isValid = false;
      result.errors.push('Tag cannot contain whitespace characters');
    }

    // Check for forbidden characters
    const forbiddenFound = this.findForbiddenCharacters(tag);
    forbiddenFound.forEach((char) => {
      result.errors.push(`Tag contains forbidden character: ${char}`);
    });

    if (forbiddenFound.length > 0) {
      result.isValid = false;
    }

    return result;
  }

  private containsWhitespace(tag: string): boolean {
    // Check for various types of whitespace characters
    // \s matches space, tab, newline, carriage return, and other Unicode whitespace
    return /\s/.test(tag);
  }

  private findForbiddenCharacters(tag: string): string[] {
    const found: string[] = [];

    for (const char of this.FORBIDDEN_CHARACTERS) {
      if (tag.includes(char) && !found.includes(char)) {
        found.push(char);
      }
    }

    return found;
  }
}
