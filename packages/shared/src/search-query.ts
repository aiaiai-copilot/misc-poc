export class SearchQuery {
  private readonly _value: string;

  constructor(query: string) {
    if (query == null) {
      throw new Error('SearchQuery cannot be null or undefined');
    }

    this._value = query;
  }

  get value(): string {
    return this._value;
  }

  getTokens(): string[] {
    return this._value.split(/\s+/).filter((token) => token.length > 0);
  }

  getNormalizedTokens(removeDiacritics: boolean = false): string[] {
    const tokens = this.getTokens();

    if (removeDiacritics) {
      return tokens.map((token) => this.removeDiacritics(token.toLowerCase()));
    }

    return tokens.map((token) => token.toLowerCase());
  }

  isEmpty(): boolean {
    return this.getTokens().length === 0;
  }

  matches(text: string, removeDiacritics: boolean = false): boolean {
    const queryTokens = this.getNormalizedTokens(removeDiacritics);

    if (queryTokens.length === 0) {
      return true;
    }

    const normalizedText = removeDiacritics
      ? this.removeDiacritics(text.toLowerCase())
      : text.toLowerCase();

    return queryTokens.every((token) => normalizedText.includes(token));
  }

  equals(other: SearchQuery): boolean {
    if (!other || !(other instanceof SearchQuery)) {
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

  private removeDiacritics(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}
