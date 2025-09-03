export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly severity?: 'error' | 'warning' | 'info';
  readonly path?: string;
  readonly value?: unknown;
}

export interface ValidationWarning {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly severity?: 'warning' | 'info';
}

export interface ValidationResultDTO {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
  readonly metadata?: {
    readonly recordIndex?: number;
    readonly sourceData?: unknown;
    readonly validatedAt?: string;
    readonly validationRules?: string[];
    readonly context?: unknown;
    readonly [key: string]: unknown;
  };
}

export class ValidationResultDTOMapper {
  static createValid(): ValidationResultDTO {
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  static createWithError(
    field: string,
    message: string,
    code: string
  ): ValidationResultDTO {
    return {
      isValid: false,
      errors: [
        {
          field,
          message,
          code,
        },
      ],
      warnings: [],
    };
  }

  static createWithErrors(errors: ValidationError[]): ValidationResultDTO {
    return {
      isValid: false,
      errors,
      warnings: [],
    };
  }

  static createWithWarnings(
    warnings: ValidationWarning[]
  ): ValidationResultDTO {
    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  static createWithErrorsAndWarnings(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): ValidationResultDTO {
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static createWithMetadata(metadata: {
    recordIndex?: number;
    sourceData?: unknown;
    validatedAt?: Date;
    validationRules?: string[];
    context?: unknown;
    [key: string]: unknown;
  }): ValidationResultDTO {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        ...metadata,
        validatedAt: metadata.validatedAt?.toISOString(),
      },
    };
  }

  static createFieldError(
    field: string,
    message: string,
    code: string,
    value?: unknown
  ): ValidationResultDTO {
    return {
      isValid: false,
      errors: [
        {
          field,
          message,
          code,
          path: field,
          value,
          severity: 'error',
        },
      ],
      warnings: [],
    };
  }

  static merge(results: ValidationResultDTO[]): ValidationResultDTO {
    if (results.length === 0) {
      return this.createValid();
    }

    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    for (const result of results) {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
