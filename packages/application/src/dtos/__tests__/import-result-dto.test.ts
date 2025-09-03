import { ImportResultDTO, ImportResultDTOMapper } from '../import-result-dto';
import { RecordDTO } from '../record-dto';
import { ValidationResultDTO } from '../validation-result-dto';

describe('ImportResultDTO', () => {
  const mockSuccessfulRecords: RecordDTO[] = [
    {
      id: 'record-1',
      content: 'First record',
      tagIds: ['tag-1', 'tag-2'],
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 'record-2',
      content: 'Second record',
      tagIds: ['tag-2', 'tag-3'],
      createdAt: '2023-01-02T00:00:00.000Z',
      updatedAt: '2023-01-02T00:00:00.000Z',
    },
  ];

  const mockErrors: ValidationResultDTO[] = [
    {
      isValid: false,
      errors: [
        {
          field: 'content',
          message: 'Content cannot be empty',
          code: 'REQUIRED_FIELD',
        },
      ],
      warnings: [],
      metadata: {
        recordIndex: 3,
        sourceData: 'invalid record data',
      },
    },
  ];

  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: ImportResultDTO = {
        success: true,
        totalProcessed: 3,
        successCount: 2,
        errorCount: 1,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 1500,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
        },
      };

      expect(dto.success).toBe(true);
      expect(dto.totalProcessed).toBe(3);
      expect(dto.successCount).toBe(2);
      expect(dto.errorCount).toBe(1);
      expect(dto.importedAt).toBe('2023-01-15T10:30:00.000Z');
      expect(dto.duration).toBe(1500);
      expect(dto.summary.recordsCreated).toBe(2);
    });

    it('should support optional fields', () => {
      const dtoWithOptionalFields: ImportResultDTO = {
        success: true,
        totalProcessed: 2,
        successCount: 2,
        errorCount: 0,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 1000,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
        successfulRecords: mockSuccessfulRecords,
        errors: [],
        warnings: [
          {
            message: 'Some tags were automatically normalized',
            code: 'TAG_NORMALIZED',
            details: { count: 3 },
          },
        ],
        source: {
          filename: 'import.json',
          format: 'json',
          fileSize: 2048,
        },
        importId: 'import-123',
        importedBy: 'user-456',
      };

      expect(dtoWithOptionalFields.successfulRecords).toBe(
        mockSuccessfulRecords
      );
      expect(dtoWithOptionalFields.errors).toEqual([]);
      expect(dtoWithOptionalFields.warnings).toHaveLength(1);
      expect(dtoWithOptionalFields.source?.filename).toBe('import.json');
      expect(dtoWithOptionalFields.importId).toBe('import-123');
      expect(dtoWithOptionalFields.importedBy).toBe('user-456');
    });

    it('should support different source formats', () => {
      const formats: Array<'json' | 'csv' | 'xml' | 'yaml'> = [
        'json',
        'csv',
        'xml',
        'yaml',
      ];

      formats.forEach((format) => {
        const dto: ImportResultDTO = {
          success: true,
          totalProcessed: 1,
          successCount: 1,
          errorCount: 0,
          importedAt: '2023-01-15T10:30:00.000Z',
          duration: 500,
          summary: {
            recordsCreated: 1,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsFailed: 0,
          },
          source: {
            filename: `import.${format}`,
            format: format,
            fileSize: 1024,
          },
        };

        expect(dto.source?.format).toBe(format);
      });
    });
  });

  describe('success and error handling', () => {
    it('should handle fully successful import', () => {
      const dto: ImportResultDTO = {
        success: true,
        totalProcessed: 2,
        successCount: 2,
        errorCount: 0,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 800,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
        successfulRecords: mockSuccessfulRecords,
        errors: [],
      };

      expect(dto.success).toBe(true);
      expect(dto.errorCount).toBe(0);
      expect(dto.errors).toEqual([]);
      expect(dto.summary.recordsFailed).toBe(0);
    });

    it('should handle partially successful import', () => {
      const dto: ImportResultDTO = {
        success: false,
        totalProcessed: 3,
        successCount: 2,
        errorCount: 1,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 1200,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
        },
        successfulRecords: mockSuccessfulRecords,
        errors: mockErrors,
      };

      expect(dto.success).toBe(false);
      expect(dto.successCount).toBe(2);
      expect(dto.errorCount).toBe(1);
      expect(dto.errors).toHaveLength(1);
    });

    it('should handle completely failed import', () => {
      const dto: ImportResultDTO = {
        success: false,
        totalProcessed: 1,
        successCount: 0,
        errorCount: 1,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 100,
        summary: {
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
        },
        errors: mockErrors,
      };

      expect(dto.success).toBe(false);
      expect(dto.successCount).toBe(0);
      expect(dto.summary.recordsCreated).toBe(0);
    });

    it('should validate count consistency', () => {
      const dto: ImportResultDTO = {
        success: true,
        totalProcessed: 5,
        successCount: 3,
        errorCount: 2,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 1500,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 1,
          recordsSkipped: 0,
          recordsFailed: 2,
        },
      };

      expect(dto.successCount + dto.errorCount).toBe(dto.totalProcessed);
      expect(
        dto.summary.recordsCreated +
          dto.summary.recordsUpdated +
          dto.summary.recordsSkipped +
          dto.summary.recordsFailed
      ).toBe(dto.totalProcessed);
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: ImportResultDTO = {
        success: true,
        totalProcessed: 2,
        successCount: 2,
        errorCount: 0,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 1000,
        summary: {
          recordsCreated: 2,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
        successfulRecords: mockSuccessfulRecords,
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ImportResultDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve nested error structure during serialization', () => {
      const dto: ImportResultDTO = {
        success: false,
        totalProcessed: 1,
        successCount: 0,
        errorCount: 1,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 500,
        summary: {
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 1,
        },
        errors: mockErrors,
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ImportResultDTO;

      expect(deserialized.errors?.[0].errors[0].field).toBe('content');
      expect(deserialized.errors?.[0].metadata?.recordIndex).toBe(3);
    });

    it('should preserve source metadata during serialization', () => {
      const dto: ImportResultDTO = {
        success: true,
        totalProcessed: 1,
        successCount: 1,
        errorCount: 0,
        importedAt: '2023-01-15T10:30:00.000Z',
        duration: 500,
        summary: {
          recordsCreated: 1,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: 0,
        },
        source: {
          filename: 'data.csv',
          format: 'csv',
          fileSize: 4096,
          originalPath: '/uploads/data.csv',
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ImportResultDTO;

      expect(deserialized.source?.filename).toBe('data.csv');
      expect(deserialized.source?.originalPath).toBe('/uploads/data.csv');
    });
  });

  describe('ImportResultDTOMapper', () => {
    it('should create successful ImportResultDTO', () => {
      const startTime = new Date('2023-01-15T10:30:00.000Z');
      const endTime = new Date('2023-01-15T10:30:01.500Z');

      const dto = ImportResultDTOMapper.createSuccess(
        mockSuccessfulRecords,
        startTime,
        endTime
      );

      expect(dto.success).toBe(true);
      expect(dto.totalProcessed).toBe(2);
      expect(dto.successCount).toBe(2);
      expect(dto.errorCount).toBe(0);
      expect(dto.duration).toBe(1500);
      expect(dto.successfulRecords).toBe(mockSuccessfulRecords);
      expect(dto.summary.recordsCreated).toBe(2);
    });

    it('should create failed ImportResultDTO', () => {
      const startTime = new Date('2023-01-15T10:30:00.000Z');
      const endTime = new Date('2023-01-15T10:30:02.000Z');

      const dto = ImportResultDTOMapper.createFailure(
        mockErrors,
        startTime,
        endTime
      );

      expect(dto.success).toBe(false);
      expect(dto.totalProcessed).toBe(1);
      expect(dto.successCount).toBe(0);
      expect(dto.errorCount).toBe(1);
      expect(dto.duration).toBe(2000);
      expect(dto.errors).toBe(mockErrors);
      expect(dto.summary.recordsFailed).toBe(1);
    });

    it('should create partial ImportResultDTO', () => {
      const startTime = new Date('2023-01-15T10:30:00.000Z');
      const endTime = new Date('2023-01-15T10:30:03.200Z');

      const dto = ImportResultDTOMapper.createPartial(
        mockSuccessfulRecords,
        mockErrors,
        startTime,
        endTime
      );

      expect(dto.success).toBe(false);
      expect(dto.totalProcessed).toBe(3);
      expect(dto.successCount).toBe(2);
      expect(dto.errorCount).toBe(1);
      expect(dto.duration).toBe(3200);
      expect(dto.successfulRecords).toBe(mockSuccessfulRecords);
      expect(dto.errors).toBe(mockErrors);
    });

    it('should add source information', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1000);

      const dto = ImportResultDTOMapper.createWithSource(
        mockSuccessfulRecords,
        [],
        startTime,
        endTime,
        {
          filename: 'import.json',
          format: 'json',
          fileSize: 2048,
          originalPath: '/uploads/import.json',
        }
      );

      expect(dto.source?.filename).toBe('import.json');
      expect(dto.source?.format).toBe('json');
      expect(dto.source?.fileSize).toBe(2048);
    });

    it('should add warnings to result', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1000);
      const warnings = [
        {
          message: 'Some tags were normalized',
          code: 'TAG_NORMALIZED',
          details: { count: 3 },
        },
      ];

      const dto = ImportResultDTOMapper.createWithWarnings(
        mockSuccessfulRecords,
        [],
        warnings,
        startTime,
        endTime
      );

      expect(dto.warnings).toHaveLength(1);
      expect(dto.warnings?.[0].code).toBe('TAG_NORMALIZED');
    });

    it('should generate unique import ID', () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1000);

      const dto1 = ImportResultDTOMapper.createWithId(
        [],
        [],
        startTime,
        endTime
      );
      const dto2 = ImportResultDTOMapper.createWithId(
        [],
        [],
        startTime,
        endTime
      );

      expect(dto1.importId).toBeDefined();
      expect(dto2.importId).toBeDefined();
      expect(dto1.importId).not.toBe(dto2.importId);
    });
  });

  describe('data transformation', () => {
    it('should transform Date objects to ISO strings', () => {
      const startTime = new Date('2023-01-15T10:30:00.000Z');
      const endTime = new Date('2023-01-15T10:30:01.500Z');

      const dto = ImportResultDTOMapper.createSuccess([], startTime, endTime);

      expect(typeof dto.importedAt).toBe('string');
      expect(dto.importedAt).toBe('2023-01-15T10:30:01.500Z');
    });

    it('should calculate duration in milliseconds', () => {
      const startTime = new Date('2023-01-15T10:30:00.000Z');
      const endTime = new Date('2023-01-15T10:30:02.500Z');

      const dto = ImportResultDTOMapper.createSuccess([], startTime, endTime);

      expect(dto.duration).toBe(2500);
    });

    it('should calculate summary statistics correctly', () => {
      const records: RecordDTO[] = [
        { ...mockSuccessfulRecords[0], metadata: { operation: 'create' } },
        { ...mockSuccessfulRecords[1], metadata: { operation: 'update' } },
      ];

      const dto = ImportResultDTOMapper.createWithOperationStats(
        records,
        [],
        new Date(),
        new Date(),
        { created: 1, updated: 1, skipped: 0 }
      );

      expect(dto.summary.recordsCreated).toBe(1);
      expect(dto.summary.recordsUpdated).toBe(1);
      expect(dto.summary.recordsSkipped).toBe(0);
    });

    it('should determine success based on error count', () => {
      const noErrorsDto = ImportResultDTOMapper.createPartial(
        mockSuccessfulRecords,
        [],
        new Date(),
        new Date()
      );

      const withErrorsDto = ImportResultDTOMapper.createPartial(
        mockSuccessfulRecords,
        mockErrors,
        new Date(),
        new Date()
      );

      expect(noErrorsDto.success).toBe(true);
      expect(withErrorsDto.success).toBe(false);
    });
  });
});
