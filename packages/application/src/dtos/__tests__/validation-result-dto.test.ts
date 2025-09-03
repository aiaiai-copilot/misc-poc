import {
  ValidationResultDTO,
  ValidationResultDTOMapper,
} from '../validation-result-dto';

describe('ValidationResultDTO', () => {
  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content cannot be empty',
            code: 'REQUIRED_FIELD',
          },
        ],
        warnings: [],
      };

      expect(dto.isValid).toBe(false);
      expect(dto.errors).toHaveLength(1);
      expect(dto.errors[0].field).toBe('content');
      expect(dto.errors[0].message).toBe('Content cannot be empty');
      expect(dto.errors[0].code).toBe('REQUIRED_FIELD');
      expect(dto.warnings).toEqual([]);
    });

    it('should support optional fields', () => {
      const dtoWithOptionalFields: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'tagIds',
            message: 'Invalid tag format',
            code: 'INVALID_FORMAT',
            severity: 'error',
            path: 'tagIds[0]',
            value: 'invalid-tag',
          },
        ],
        warnings: [
          {
            field: 'content',
            message: 'Content is very long',
            code: 'LENGTH_WARNING',
            severity: 'warning',
          },
        ],
        metadata: {
          recordIndex: 5,
          sourceData: 'original data',
          validatedAt: '2023-01-15T10:30:00.000Z',
          validationRules: ['required', 'format', 'length'],
        },
      };

      expect(dtoWithOptionalFields.errors[0].severity).toBe('error');
      expect(dtoWithOptionalFields.errors[0].path).toBe('tagIds[0]');
      expect(dtoWithOptionalFields.errors[0].value).toBe('invalid-tag');
      expect(dtoWithOptionalFields.warnings[0].severity).toBe('warning');
      expect(dtoWithOptionalFields.metadata?.recordIndex).toBe(5);
      expect(dtoWithOptionalFields.metadata?.validationRules).toContain(
        'required'
      );
    });

    it('should support different severity levels', () => {
      const severityLevels: Array<'error' | 'warning' | 'info'> = [
        'error',
        'warning',
        'info',
      ];

      severityLevels.forEach((severity) => {
        const dto: ValidationResultDTO = {
          isValid: severity !== 'error',
          errors:
            severity === 'error'
              ? [
                  {
                    field: 'test',
                    message: 'Test message',
                    code: 'TEST_CODE',
                    severity: severity,
                  },
                ]
              : [],
          warnings:
            severity === 'warning'
              ? [
                  {
                    field: 'test',
                    message: 'Test warning',
                    code: 'TEST_WARNING',
                    severity: severity,
                  },
                ]
              : [],
        };

        if (severity === 'error') {
          expect(dto.errors[0].severity).toBe(severity);
        } else if (severity === 'warning') {
          expect(dto.warnings[0].severity).toBe(severity);
        }
      });
    });

    it('should support nested field paths', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'metadata',
            message: 'Invalid nested field',
            code: 'NESTED_VALIDATION',
            path: 'metadata.nested.field',
          },
        ],
        warnings: [],
      };

      expect(dto.errors[0].path).toBe('metadata.nested.field');
    });
  });

  describe('validation state logic', () => {
    it('should be valid when no errors exist', () => {
      const dto: ValidationResultDTO = {
        isValid: true,
        errors: [],
        warnings: [
          {
            field: 'content',
            message: 'Consider shortening content',
            code: 'LENGTH_SUGGESTION',
          },
        ],
      };

      expect(dto.isValid).toBe(true);
      expect(dto.errors).toEqual([]);
    });

    it('should be invalid when errors exist', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content is required',
            code: 'REQUIRED_FIELD',
          },
        ],
        warnings: [],
      };

      expect(dto.isValid).toBe(false);
      expect(dto.errors).toHaveLength(1);
    });

    it('should handle multiple errors on same field', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content is required',
            code: 'REQUIRED_FIELD',
          },
          {
            field: 'content',
            message: 'Content must be at least 3 characters',
            code: 'MIN_LENGTH',
          },
        ],
        warnings: [],
      };

      const contentErrors = dto.errors.filter(
        (error) => error.field === 'content'
      );
      expect(contentErrors).toHaveLength(2);
    });

    it('should handle multiple errors on different fields', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content is required',
            code: 'REQUIRED_FIELD',
          },
          {
            field: 'tagIds',
            message: 'At least one tag is required',
            code: 'MIN_TAGS',
          },
        ],
        warnings: [],
      };

      const fields = dto.errors.map((error) => error.field);
      expect(fields).toContain('content');
      expect(fields).toContain('tagIds');
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content cannot be empty',
            code: 'REQUIRED_FIELD',
            severity: 'error',
            path: 'content',
            value: '',
          },
        ],
        warnings: [
          {
            field: 'tagIds',
            message: 'Consider adding more tags',
            code: 'TAG_SUGGESTION',
            severity: 'info',
          },
        ],
        metadata: {
          recordIndex: 1,
          sourceData: 'test data',
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ValidationResultDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve metadata structure during serialization', () => {
      const dto: ValidationResultDTO = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          recordIndex: 10,
          sourceData: { complex: { nested: 'data' } },
          validatedAt: '2023-01-15T10:30:00.000Z',
          validationRules: ['required', 'format'],
          context: {
            operation: 'import',
            userId: 'user-123',
          },
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ValidationResultDTO;

      expect(deserialized.metadata?.context?.operation).toBe('import');
      expect(deserialized.metadata?.validationRules).toEqual([
        'required',
        'format',
      ]);
    });

    it('should handle undefined optional fields during serialization', () => {
      const dto: ValidationResultDTO = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ValidationResultDTO;

      expect(deserialized.metadata).toBeUndefined();
      expect(deserialized.errors).toEqual([]);
      expect(deserialized.warnings).toEqual([]);
    });
  });

  describe('ValidationResultDTOMapper', () => {
    it('should create valid ValidationResultDTO', () => {
      const dto = ValidationResultDTOMapper.createValid();

      expect(dto.isValid).toBe(true);
      expect(dto.errors).toEqual([]);
      expect(dto.warnings).toEqual([]);
    });

    it('should create ValidationResultDTO with single error', () => {
      const dto = ValidationResultDTOMapper.createWithError(
        'content',
        'Content is required',
        'REQUIRED_FIELD'
      );

      expect(dto.isValid).toBe(false);
      expect(dto.errors).toHaveLength(1);
      expect(dto.errors[0].field).toBe('content');
      expect(dto.errors[0].message).toBe('Content is required');
      expect(dto.errors[0].code).toBe('REQUIRED_FIELD');
    });

    it('should create ValidationResultDTO with multiple errors', () => {
      const errors = [
        {
          field: 'content',
          message: 'Content is required',
          code: 'REQUIRED_FIELD',
        },
        {
          field: 'tagIds',
          message: 'Invalid tag format',
          code: 'INVALID_FORMAT',
        },
      ];

      const dto = ValidationResultDTOMapper.createWithErrors(errors);

      expect(dto.isValid).toBe(false);
      expect(dto.errors).toHaveLength(2);
      expect(dto.errors).toEqual(errors);
    });

    it('should create ValidationResultDTO with warnings', () => {
      const warnings = [
        {
          field: 'content',
          message: 'Content is very long',
          code: 'LENGTH_WARNING',
        },
      ];

      const dto = ValidationResultDTOMapper.createWithWarnings(warnings);

      expect(dto.isValid).toBe(true);
      expect(dto.errors).toEqual([]);
      expect(dto.warnings).toEqual(warnings);
    });

    it('should create ValidationResultDTO with both errors and warnings', () => {
      const errors = [
        {
          field: 'content',
          message: 'Content is required',
          code: 'REQUIRED_FIELD',
        },
      ];

      const warnings = [
        {
          field: 'tagIds',
          message: 'Consider adding more tags',
          code: 'TAG_SUGGESTION',
        },
      ];

      const dto = ValidationResultDTOMapper.createWithErrorsAndWarnings(
        errors,
        warnings
      );

      expect(dto.isValid).toBe(false);
      expect(dto.errors).toEqual(errors);
      expect(dto.warnings).toEqual(warnings);
    });

    it('should create ValidationResultDTO with metadata', () => {
      const metadata = {
        recordIndex: 5,
        sourceData: 'test data',
        validatedAt: new Date('2023-01-15T10:30:00.000Z'),
        validationRules: ['required', 'format'],
      };

      const dto = ValidationResultDTOMapper.createWithMetadata(metadata);

      expect(dto.metadata?.recordIndex).toBe(5);
      expect(dto.metadata?.sourceData).toBe('test data');
      expect(dto.metadata?.validatedAt).toBe('2023-01-15T10:30:00.000Z');
      expect(dto.metadata?.validationRules).toEqual(['required', 'format']);
    });

    it('should merge multiple ValidationResultDTOs', () => {
      const dto1: ValidationResultDTO = {
        isValid: false,
        errors: [
          {
            field: 'content',
            message: 'Content is required',
            code: 'REQUIRED_FIELD',
          },
        ],
        warnings: [],
      };

      const dto2: ValidationResultDTO = {
        isValid: true,
        errors: [],
        warnings: [
          {
            field: 'tagIds',
            message: 'Consider adding tags',
            code: 'TAG_SUGGESTION',
          },
        ],
      };

      const merged = ValidationResultDTOMapper.merge([dto1, dto2]);

      expect(merged.isValid).toBe(false); // Should be false if any validation failed
      expect(merged.errors).toHaveLength(1);
      expect(merged.warnings).toHaveLength(1);
    });

    it('should handle empty merge array', () => {
      const merged = ValidationResultDTOMapper.merge([]);

      expect(merged.isValid).toBe(true);
      expect(merged.errors).toEqual([]);
      expect(merged.warnings).toEqual([]);
    });
  });

  describe('data transformation', () => {
    it('should transform Date objects to ISO strings in metadata', () => {
      const metadata = {
        recordIndex: 1,
        validatedAt: new Date('2023-01-15T10:30:00.000Z'),
      };

      const dto = ValidationResultDTOMapper.createWithMetadata(metadata);

      expect(typeof dto.metadata?.validatedAt).toBe('string');
      expect(dto.metadata?.validatedAt).toBe('2023-01-15T10:30:00.000Z');
    });

    it('should preserve complex nested data in metadata', () => {
      const metadata = {
        sourceData: {
          record: {
            id: 'record-1',
            nested: {
              field: 'value',
            },
          },
        },
        context: {
          operation: 'import',
          batch: { id: 'batch-1', index: 5 },
        },
      };

      const dto = ValidationResultDTOMapper.createWithMetadata(metadata);

      expect(dto.metadata?.sourceData).toEqual(metadata.sourceData);
      expect(dto.metadata?.context).toEqual(metadata.context);
    });

    it('should determine validation state from errors', () => {
      const validDto = ValidationResultDTOMapper.createWithWarnings([
        { field: 'test', message: 'warning', code: 'WARN' },
      ]);

      const invalidDto = ValidationResultDTOMapper.createWithErrors([
        { field: 'test', message: 'error', code: 'ERR' },
      ]);

      expect(validDto.isValid).toBe(true);
      expect(invalidDto.isValid).toBe(false);
    });

    it('should handle field path generation', () => {
      const dto = ValidationResultDTOMapper.createFieldError(
        'metadata.tags[0].name',
        'Invalid tag name',
        'INVALID_TAG_NAME',
        'invalid-name'
      );

      expect(dto.errors[0].field).toBe('metadata.tags[0].name');
      expect(dto.errors[0].path).toBe('metadata.tags[0].name');
      expect(dto.errors[0].value).toBe('invalid-name');
    });
  });
});
