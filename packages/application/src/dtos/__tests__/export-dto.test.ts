import { ExportDTO, ExportDTOMapper } from '../export-dto';
import { RecordDTO } from '../record-dto';

describe('ExportDTO', () => {
  const mockRecords: RecordDTO[] = [
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

  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      expect(dto.records).toBe(mockRecords);
      expect(dto.format).toBe('json');
      expect(dto.exportedAt).toBe('2023-01-15T10:30:00.000Z');
      expect(dto.version).toBe('1.0');
      expect(dto.metadata.totalRecords).toBe(2);
      expect(dto.metadata.exportSource).toBe('full-database');
    });

    it('should support different format types', () => {
      const formats: Array<'json' | 'csv' | 'xml' | 'yaml'> = [
        'json',
        'csv',
        'xml',
        'yaml',
      ];

      formats.forEach((format) => {
        const dto: ExportDTO = {
          records: mockRecords,
          format: format,
          exportedAt: '2023-01-15T10:30:00.000Z',
          version: '1.0',
          metadata: {
            totalRecords: 2,
            exportSource: 'full-database',
          },
        };

        expect(dto.format).toBe(format);
      });
    });

    it('should support optional metadata fields', () => {
      const dtoWithExtendedMetadata: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'search-results',
          searchQuery: 'javascript',
          filters: {
            tagIds: ['tag-1', 'tag-2'],
            dateRange: {
              from: '2023-01-01T00:00:00.000Z',
              to: '2023-01-31T23:59:59.999Z',
            },
          },
          exportedBy: 'user-123',
          compressed: true,
          fileSize: 2048,
        },
      };

      expect(dtoWithExtendedMetadata.metadata.searchQuery).toBe('javascript');
      expect(dtoWithExtendedMetadata.metadata.exportedBy).toBe('user-123');
      expect(dtoWithExtendedMetadata.metadata.compressed).toBe(true);
      expect(dtoWithExtendedMetadata.metadata.fileSize).toBe(2048);
    });

    it('should support optional schema field', () => {
      const dtoWithSchema: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
        schema: {
          version: '1.0',
          fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'tagIds', type: 'array', required: true },
            { name: 'createdAt', type: 'datetime', required: true },
            { name: 'updatedAt', type: 'datetime', required: true },
          ],
        },
      };

      expect(dtoWithSchema.schema?.version).toBe('1.0');
      expect(dtoWithSchema.schema?.fields).toHaveLength(5);
      expect(dtoWithSchema.schema?.fields[0].name).toBe('id');
    });
  });

  describe('data export format validation', () => {
    it('should handle empty records array', () => {
      const dto: ExportDTO = {
        records: [],
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 0,
          exportSource: 'empty-search',
        },
      };

      expect(dto.records).toEqual([]);
      expect(dto.metadata.totalRecords).toBe(0);
    });

    it('should validate metadata consistency', () => {
      const dto: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      expect(dto.records.length).toBe(dto.metadata.totalRecords);
    });

    it('should support large record counts', () => {
      const dto: ExportDTO = {
        records: [],
        format: 'csv',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 10000,
          exportSource: 'full-database',
          compressed: true,
          fileSize: 1024 * 1024, // 1MB
        },
      };

      expect(dto.metadata.totalRecords).toBe(10000);
      expect(dto.metadata.compressed).toBe(true);
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ExportDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve nested metadata structure during serialization', () => {
      const dto: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'search-results',
          filters: {
            tagIds: ['tag-1'],
            dateRange: {
              from: '2023-01-01T00:00:00.000Z',
              to: '2023-01-31T23:59:59.999Z',
            },
          },
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ExportDTO;

      expect(deserialized.metadata.filters?.tagIds).toEqual(['tag-1']);
      expect(deserialized.metadata.filters?.dateRange?.from).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });

    it('should preserve schema structure during serialization', () => {
      const dto: ExportDTO = {
        records: mockRecords,
        format: 'json',
        exportedAt: '2023-01-15T10:30:00.000Z',
        version: '1.0',
        metadata: {
          totalRecords: 2,
          exportSource: 'full-database',
        },
        schema: {
          version: '1.0',
          fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
          ],
        },
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as ExportDTO;

      expect(deserialized.schema?.fields).toHaveLength(2);
      expect(deserialized.schema?.fields[0].required).toBe(true);
    });
  });

  describe('ExportDTOMapper', () => {
    it('should create ExportDTO from records and format', () => {
      const dto = ExportDTOMapper.create(mockRecords, 'json');

      expect(dto.records).toBe(mockRecords);
      expect(dto.format).toBe('json');
      expect(dto.version).toBe('1.0');
      expect(dto.metadata.totalRecords).toBe(2);
      expect(dto.metadata.exportSource).toBe('full-database');
      expect(typeof dto.exportedAt).toBe('string');
    });

    it('should create ExportDTO with search context', () => {
      const dto = ExportDTOMapper.createWithSearch(
        mockRecords,
        'csv',
        'javascript',
        {
          tagIds: ['tag-1'],
          dateRange: {
            from: new Date('2023-01-01T00:00:00.000Z'),
            to: new Date('2023-01-31T23:59:59.999Z'),
          },
        }
      );

      expect(dto.format).toBe('csv');
      expect(dto.metadata.exportSource).toBe('search-results');
      expect(dto.metadata.searchQuery).toBe('javascript');
      expect(dto.metadata.filters?.tagIds).toEqual(['tag-1']);
      expect(dto.metadata.filters?.dateRange?.from).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });

    it('should create ExportDTO with custom metadata', () => {
      const customMetadata = {
        exportedBy: 'user-123',
        compressed: true,
        fileSize: 4096,
      };

      const dto = ExportDTOMapper.createWithMetadata(
        mockRecords,
        'xml',
        customMetadata
      );

      expect(dto.format).toBe('xml');
      expect(dto.metadata.exportedBy).toBe('user-123');
      expect(dto.metadata.compressed).toBe(true);
      expect(dto.metadata.fileSize).toBe(4096);
    });

    it('should generate appropriate schema based on format', () => {
      const jsonDto = ExportDTOMapper.createWithSchema(mockRecords, 'json');
      const csvDto = ExportDTOMapper.createWithSchema(mockRecords, 'csv');

      expect(jsonDto.schema?.version).toBe('1.0');
      expect(jsonDto.schema?.fields).toHaveLength(5);
      expect(csvDto.schema?.fields).toHaveLength(5);

      const expectedFields = [
        'id',
        'content',
        'tagIds',
        'createdAt',
        'updatedAt',
      ];
      jsonDto.schema?.fields.forEach((field) => {
        expect(expectedFields).toContain(field.name);
      });
    });

    it('should handle empty records array', () => {
      const dto = ExportDTOMapper.create([], 'json');

      expect(dto.records).toEqual([]);
      expect(dto.metadata.totalRecords).toBe(0);
      expect(dto.metadata.exportSource).toBe('empty-export');
    });
  });

  describe('data transformation', () => {
    it('should transform current date to ISO string for exportedAt', () => {
      const beforeExport = new Date();
      const dto = ExportDTOMapper.create(mockRecords, 'json');
      const afterExport = new Date();

      const exportedAt = new Date(dto.exportedAt);
      expect(exportedAt.getTime()).toBeGreaterThanOrEqual(
        beforeExport.getTime()
      );
      expect(exportedAt.getTime()).toBeLessThanOrEqual(afterExport.getTime());
    });

    it('should transform Date objects to ISO strings in filters', () => {
      const dto = ExportDTOMapper.createWithSearch(
        mockRecords,
        'json',
        'test',
        {
          tagIds: ['tag-1'],
          dateRange: {
            from: new Date('2023-01-01T00:00:00.000Z'),
            to: new Date('2023-01-31T23:59:59.999Z'),
          },
        }
      );

      expect(typeof dto.metadata.filters?.dateRange?.from).toBe('string');
      expect(typeof dto.metadata.filters?.dateRange?.to).toBe('string');
      expect(dto.metadata.filters?.dateRange?.from).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });

    it('should calculate correct file size estimate for different formats', () => {
      const jsonDto = ExportDTOMapper.createWithMetadata(mockRecords, 'json', {
        compressed: false,
      });
      const csvDto = ExportDTOMapper.createWithMetadata(mockRecords, 'csv', {
        compressed: false,
      });
      const compressedDto = ExportDTOMapper.createWithMetadata(
        mockRecords,
        'json',
        { compressed: true }
      );

      expect(jsonDto.metadata.fileSize).toBeGreaterThan(0);
      expect(csvDto.metadata.fileSize).toBeGreaterThan(0);
      if (compressedDto.metadata.compressed) {
        expect(compressedDto.metadata.fileSize).toBeLessThan(
          jsonDto.metadata.fileSize!
        );
      }
    });
  });
});
