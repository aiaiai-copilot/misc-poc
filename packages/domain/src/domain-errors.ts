export class DomainError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DomainError.prototype);

    // Capture stack trace, excluding constructor call from it
    if ('captureStackTrace' in Error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class InvalidRecordContentError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('INVALID_RECORD_CONTENT', message, context);
    this.name = 'InvalidRecordContentError';
    Object.setPrototypeOf(this, InvalidRecordContentError.prototype);
  }
}

export class InvalidTagError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('INVALID_TAG', message, context);
    this.name = 'InvalidTagError';
    Object.setPrototypeOf(this, InvalidTagError.prototype);
  }
}

export class DuplicateRecordError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('DUPLICATE_RECORD', message, context);
    this.name = 'DuplicateRecordError';
    Object.setPrototypeOf(this, DuplicateRecordError.prototype);
  }
}

export class TagLimitExceededError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('TAG_LIMIT_EXCEEDED', message, context);
    this.name = 'TagLimitExceededError';
    Object.setPrototypeOf(this, TagLimitExceededError.prototype);
  }
}
