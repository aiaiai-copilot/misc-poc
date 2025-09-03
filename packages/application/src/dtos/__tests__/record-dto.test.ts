import { RecordDTO, RecordDTOMapper } from '../record-dto';
import { Record } from '@misc-poc/domain';
import { RecordId, RecordContent, TagId } from '@misc-poc/shared';

describe('RecordDTO', () => {
  const mockTagIds = [
    new TagId('550e8400-e29b-41d4-a716-446655440001'),
    new TagId('550e8400-e29b-41d4-a716-446655440002'),
    new TagId('550e8400-e29b-41d4-a716-446655440003'),
  ];
  const mockCreatedAt = new Date('2023-01-01T00:00:00.000Z');
  const mockUpdatedAt = new Date('2023-01-02T00:00:00.000Z');

  const mockRecord = new Record(
    new RecordId('550e8400-e29b-41d4-a716-446655440000'),
    new RecordContent('Test content'),
    new Set(mockTagIds),
    mockCreatedAt,
    mockUpdatedAt
  );

  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: RecordDTO = {
        id: 'record-1',
        content: 'Test content',
        tagIds: ['tag-1', 'tag-2'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };

      expect(dto.id).toBe('record-1');
      expect(dto.content).toBe('Test content');
      expect(dto.tagIds).toEqual(['tag-1', 'tag-2']);
      expect(dto.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(dto.updatedAt).toBe('2023-01-02T00:00:00.000Z');
    });

    it('should support optional fields', () => {
      const dtoWithOptionalFields: RecordDTO = {
        id: 'record-1',
        content: 'Test content',
        tagIds: ['tag-1'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        metadata: {
          source: 'import',
          version: 1,
        },
      };

      expect(dtoWithOptionalFields.metadata).toBeDefined();
      expect(dtoWithOptionalFields.metadata?.source).toBe('import');
      expect(dtoWithOptionalFields.metadata?.version).toBe(1);
    });

    it('should allow empty tagIds array', () => {
      const dtoWithoutTags: RecordDTO = {
        id: 'record-1',
        content: 'Test content',
        tagIds: [],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };

      expect(dtoWithoutTags.tagIds).toEqual([]);
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: RecordDTO = {
        id: 'record-1',
        content: 'Test content',
        tagIds: ['tag-1', 'tag-2'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as RecordDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve date strings during JSON serialization', () => {
      const dto: RecordDTO = {
        id: 'record-1',
        content: 'Test content',
        tagIds: ['tag-1'],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as RecordDTO;

      expect(typeof deserialized.createdAt).toBe('string');
      expect(typeof deserialized.updatedAt).toBe('string');
      expect(deserialized.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(deserialized.updatedAt).toBe('2023-01-02T00:00:00.000Z');
    });
  });

  describe('RecordDTOMapper', () => {
    it('should map domain Record to RecordDTO', () => {
      const dto = RecordDTOMapper.toDTO(mockRecord);

      expect(dto.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(dto.content).toBe('Test content');
      expect(dto.tagIds).toEqual([
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ]);
      expect(dto.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(dto.updatedAt).toBe('2023-01-02T00:00:00.000Z');
    });

    it('should handle Record with empty tag set', () => {
      const recordWithoutTags = new Record(
        new RecordId('550e8400-e29b-41d4-a716-446655440004'),
        new RecordContent('Content without tags'),
        new Set(),
        mockCreatedAt,
        mockUpdatedAt
      );

      const dto = RecordDTOMapper.toDTO(recordWithoutTags);

      expect(dto.id).toBe('550e8400-e29b-41d4-a716-446655440004');
      expect(dto.content).toBe('Content without tags');
      expect(dto.tagIds).toEqual([]);
    });

    it('should map array of Records to array of RecordDTOs', () => {
      const records = [mockRecord];
      const dtos = RecordDTOMapper.toDTOs(records);

      expect(dtos).toHaveLength(1);
      expect(dtos[0].id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(dtos[0].content).toBe('Test content');
    });

    it('should handle empty array mapping', () => {
      const dtos = RecordDTOMapper.toDTOs([]);
      expect(dtos).toEqual([]);
    });
  });

  describe('data transformation', () => {
    it('should transform Date objects to ISO strings', () => {
      const dto = RecordDTOMapper.toDTO(mockRecord);

      expect(typeof dto.createdAt).toBe('string');
      expect(typeof dto.updatedAt).toBe('string');
      expect(new Date(dto.createdAt).toISOString()).toBe(
        mockCreatedAt.toISOString()
      );
      expect(new Date(dto.updatedAt).toISOString()).toBe(
        mockUpdatedAt.toISOString()
      );
    });

    it('should transform Set<TagId> to string array', () => {
      const dto = RecordDTOMapper.toDTO(mockRecord);

      expect(Array.isArray(dto.tagIds)).toBe(true);
      expect(dto.tagIds).toHaveLength(3);
      expect(dto.tagIds).toContain('550e8400-e29b-41d4-a716-446655440001');
      expect(dto.tagIds).toContain('550e8400-e29b-41d4-a716-446655440002');
      expect(dto.tagIds).toContain('550e8400-e29b-41d4-a716-446655440003');
    });

    it('should transform domain value objects to primitive strings', () => {
      const dto = RecordDTOMapper.toDTO(mockRecord);

      expect(typeof dto.id).toBe('string');
      expect(typeof dto.content).toBe('string');
      expect(dto.id).toBe(mockRecord.id.toString());
      expect(dto.content).toBe(mockRecord.content.toString());
    });
  });
});
