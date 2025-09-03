import { TagCloudItemDTO, TagCloudItemDTOMapper } from '../tag-cloud-item-dto';
import { TagUsageInfo } from '../../ports/tag-repository';
import { Tag } from '@misc-poc/domain';
import { TagId } from '@misc-poc/shared';

describe('TagCloudItemDTO', () => {
  const mockTag = new Tag(
    new TagId('550e8400-e29b-41d4-a716-446655440001'),
    'javascript'
  );
  const mockTagUsageInfo: TagUsageInfo = {
    tag: mockTag,
    usageCount: 15,
  };

  describe('TypeScript typing', () => {
    it('should have correct type definition for required fields', () => {
      const dto: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'javascript',
        displayValue: 'JavaScript',
        usageCount: 15,
        weight: 0.75,
        fontSize: 'large',
      };

      expect(dto.id).toBe('tag-1');
      expect(dto.normalizedValue).toBe('javascript');
      expect(dto.displayValue).toBe('JavaScript');
      expect(dto.usageCount).toBe(15);
      expect(dto.weight).toBe(0.75);
      expect(dto.fontSize).toBe('large');
    });

    it('should support optional color field', () => {
      const dtoWithColor: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'javascript',
        displayValue: 'JavaScript',
        usageCount: 15,
        weight: 0.75,
        fontSize: 'large',
        color: '#3178c6',
      };

      expect(dtoWithColor.color).toBe('#3178c6');
    });

    it('should support different font size values', () => {
      const sizes: Array<'small' | 'medium' | 'large' | 'xlarge'> = [
        'small',
        'medium',
        'large',
        'xlarge',
      ];

      sizes.forEach((size) => {
        const dto: TagCloudItemDTO = {
          id: 'tag-1',
          normalizedValue: 'test',
          displayValue: 'Test',
          usageCount: 5,
          weight: 0.5,
          fontSize: size,
        };

        expect(dto.fontSize).toBe(size);
      });
    });

    it('should support optional category field', () => {
      const dtoWithCategory: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'javascript',
        displayValue: 'JavaScript',
        usageCount: 15,
        weight: 0.75,
        fontSize: 'large',
        category: 'programming-language',
      };

      expect(dtoWithCategory.category).toBe('programming-language');
    });
  });

  describe('weight and fontSize calculation', () => {
    it('should handle weight values between 0 and 1', () => {
      const weights = [0, 0.25, 0.5, 0.75, 1];

      weights.forEach((weight) => {
        const dto: TagCloudItemDTO = {
          id: 'tag-1',
          normalizedValue: 'test',
          displayValue: 'Test',
          usageCount: 5,
          weight: weight,
          fontSize: 'medium',
        };

        expect(dto.weight).toBeGreaterThanOrEqual(0);
        expect(dto.weight).toBeLessThanOrEqual(1);
      });
    });

    it('should correlate fontSize with weight ranges', () => {
      const smallWeightDto: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'test',
        displayValue: 'Test',
        usageCount: 1,
        weight: 0.1,
        fontSize: 'small',
      };

      const largeWeightDto: TagCloudItemDTO = {
        id: 'tag-2',
        normalizedValue: 'popular',
        displayValue: 'Popular',
        usageCount: 100,
        weight: 0.9,
        fontSize: 'xlarge',
      };

      expect(smallWeightDto.weight).toBeLessThan(largeWeightDto.weight);
      expect(['small', 'medium'].includes(smallWeightDto.fontSize)).toBe(true);
      expect(['large', 'xlarge'].includes(largeWeightDto.fontSize)).toBe(true);
    });
  });

  describe('serialization support', () => {
    it('should be JSON serializable', () => {
      const dto: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'javascript',
        displayValue: 'JavaScript',
        usageCount: 15,
        weight: 0.75,
        fontSize: 'large',
        color: '#3178c6',
        category: 'programming-language',
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as TagCloudItemDTO;

      expect(deserialized).toEqual(dto);
    });

    it('should preserve numeric precision for weight', () => {
      const dto: TagCloudItemDTO = {
        id: 'tag-1',
        normalizedValue: 'test',
        displayValue: 'Test',
        usageCount: 7,
        weight: 0.123456789,
        fontSize: 'medium',
      };

      const serialized = JSON.stringify(dto);
      const deserialized = JSON.parse(serialized) as TagCloudItemDTO;

      expect(deserialized.weight).toBe(0.123456789);
    });
  });

  describe('TagCloudItemDTOMapper', () => {
    it('should map TagUsageInfo to TagCloudItemDTO', () => {
      const dto = TagCloudItemDTOMapper.toDTO(mockTagUsageInfo, 0.75);

      expect(dto.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(dto.normalizedValue).toBe('javascript');
      expect(dto.usageCount).toBe(15);
      expect(dto.weight).toBe(0.75);
    });

    it('should calculate appropriate fontSize based on weight', () => {
      const testCases = [
        { weight: 0.1, expectedSize: 'small' },
        { weight: 0.3, expectedSize: 'medium' },
        { weight: 0.7, expectedSize: 'large' },
        { weight: 0.9, expectedSize: 'xlarge' },
      ] as const;

      testCases.forEach(({ weight, expectedSize }) => {
        const dto = TagCloudItemDTOMapper.toDTO(mockTagUsageInfo, weight);
        expect(dto.fontSize).toBe(expectedSize);
      });
    });

    it('should generate displayValue from normalizedValue', () => {
      const testTag = new Tag(
        new TagId('550e8400-e29b-41d4-a716-446655440002'),
        'react-hooks'
      );
      const tagUsage: TagUsageInfo = {
        tag: testTag,
        usageCount: 8,
      };

      const dto = TagCloudItemDTOMapper.toDTO(tagUsage, 0.5);

      expect(dto.normalizedValue).toBe('react-hooks');
      expect(dto.displayValue).toBe('React Hooks'); // Should capitalize and format
    });

    it('should map array of TagUsageInfo to array of TagCloudItemDTO', () => {
      const tagUsages: TagUsageInfo[] = [
        mockTagUsageInfo,
        {
          tag: new Tag(
            new TagId('550e8400-e29b-41d4-a716-446655440002'),
            'python'
          ),
          usageCount: 20,
        },
        {
          tag: new Tag(
            new TagId('550e8400-e29b-41d4-a716-446655440003'),
            'react'
          ),
          usageCount: 5,
        },
      ];

      const dtos = TagCloudItemDTOMapper.toDTOs(tagUsages);

      expect(dtos).toHaveLength(3);
      expect(dtos[1].normalizedValue).toBe('python');
      expect(dtos[1].usageCount).toBe(20);
      expect(dtos[1].weight).toBe(1); // Highest usage count gets weight 1
      expect(dtos[2].weight).toBe(0); // Lowest usage count gets weight 0
    });

    it('should handle empty array mapping', () => {
      const dtos = TagCloudItemDTOMapper.toDTOs([]);
      expect(dtos).toEqual([]);
    });

    it('should handle single item array', () => {
      const dtos = TagCloudItemDTOMapper.toDTOs([mockTagUsageInfo]);

      expect(dtos).toHaveLength(1);
      expect(dtos[0].weight).toBe(1); // Single item gets max weight
    });
  });

  describe('data transformation', () => {
    it('should transform domain Tag to DTO fields', () => {
      const dto = TagCloudItemDTOMapper.toDTO(mockTagUsageInfo, 0.75);

      expect(typeof dto.id).toBe('string');
      expect(typeof dto.normalizedValue).toBe('string');
      expect(typeof dto.displayValue).toBe('string');
      expect(dto.id).toBe(mockTag.id.toString());
      expect(dto.normalizedValue).toBe(mockTag.normalizedValue);
    });

    it('should normalize weight calculation across multiple tags', () => {
      const tagUsages: TagUsageInfo[] = [
        {
          tag: new Tag(
            new TagId('550e8400-e29b-41d4-a716-446655440001'),
            'popular'
          ),
          usageCount: 100,
        },
        {
          tag: new Tag(
            new TagId('550e8400-e29b-41d4-a716-446655440002'),
            'medium'
          ),
          usageCount: 50,
        },
        {
          tag: new Tag(
            new TagId('550e8400-e29b-41d4-a716-446655440003'),
            'rare'
          ),
          usageCount: 10,
        },
      ];

      const dtos = TagCloudItemDTOMapper.toDTOs(tagUsages);

      expect(dtos[0].weight).toBe(1); // 100 usage count = max weight
      expect(dtos[1].weight).toBeCloseTo(0.44, 2); // (50-10)/(100-10) ≈ 0.44
      expect(dtos[2].weight).toBe(0); // 10 usage count = min weight
    });

    it('should generate consistent displayValue formatting', () => {
      const testCases = [
        { normalized: 'javascript', expected: 'Javascript' },
        { normalized: 'react-hooks', expected: 'React Hooks' },
        { normalized: 'css-in-js', expected: 'Css In Js' },
        { normalized: 'node-js', expected: 'Node Js' },
      ];

      testCases.forEach(({ normalized, expected }) => {
        const tag = new Tag(
          new TagId('550e8400-e29b-41d4-a716-446655440000'),
          normalized
        );
        const tagUsage: TagUsageInfo = { tag, usageCount: 1 };
        const dto = TagCloudItemDTOMapper.toDTO(tagUsage, 0.5);

        expect(dto.displayValue).toBe(expected);
      });
    });
  });
});
